/**
 * 文档生成服务
 * 生成发票、箱单 - 使用动态矩阵生成策略
 */

import ExcelJS from 'exceljs';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { FormData, OrderItem, ColorBreakdown } from '@/types/order';

// 模板在 public 目录
const TEMPLATE_URLS = {
  invoice: '/templates/invoice template.xlsx',
  packing: '/templates/箱单packing list template.xlsx',
  contract: '/templates/contract template.docx',
};

/**
 * 加载模板文件
 */
async function loadTemplate(templateKey: 'invoice' | 'packing' | 'contract'): Promise<ArrayBuffer> {
  const url = TEMPLATE_URLS[templateKey];
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`无法加载模板: ${url}, 状态: ${response.status}`);
  }

  return response.arrayBuffer();
}

/**
 * 获取所有尺码（按顺序）
 */
function getAllSizes(items: OrderItem[]): string[] {
  const sizeSet = new Set<string>();
  items.forEach(item => {
    item.colors.forEach(color => {
      color.sizes.forEach(size => {
        sizeSet.add(size.size);
      });
    });
  });
  return Array.from(sizeSet).sort((a, b) => {
    const numA = parseFloat(a);
    const numB = parseFloat(b);
    return numA - numB;
  });
}

/**
 * 获取尺码映射
 */
function getSizeMap(color: ColorBreakdown): Map<string, number> {
  const map = new Map<string, number>();
  color.sizes.forEach(s => {
    map.set(s.size, s.quantity);
  });
  return map;
}

/**
 * 替换模板中的单点变量 - 支持纯文本和富文本
 * Pass 1：全局静态变量替换
 */
function replaceSimpleVariables(worksheet: ExcelJS.Worksheet, variables: Record<string, string | number>) {
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      // 处理纯文本类型
      if (typeof cell.value === 'string') {
        let value = cell.value;
        for (const [key, val] of Object.entries(variables)) {
          // 支持 {{key}} 格式
          value = value.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(val));
        }
        if (value !== cell.value) {
          cell.value = value;
        }
      }

      // 处理富文本类型 (RichText)
      if (cell.value && typeof cell.value === 'object' && 'richText' in cell.value) {
        const richText = cell.value as { richText: Array<{ text: string }> };
        if (richText.richText && Array.isArray(richText.richText)) {
          let modified = false;
          const newRichText = richText.richText.map((rt) => {
            let text = rt.text;
            for (const [key, val] of Object.entries(variables)) {
              const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
              if (regex.test(text)) {
                text = text.replace(regex, String(val));
                modified = true;
              }
            }
            return { text };
          });
          if (modified) {
            cell.value = { richText: newRichText };
          }
        }
      }
    });
  });
}

/**
 * 设置单元格边框样式
 */
function setCellBorder(cell: ExcelJS.Cell, style: 'thin' | 'medium' = 'thin') {
  cell.border = {
    top: { style },
    left: { style },
    bottom: { style },
    right: { style }
  };
}

/**
 * 动态生成发票
 */
export async function generateInvoice(formData: FormData): Promise<Blob> {
  console.log('=== 开始生成发票（动态矩阵）===');

  const templateBuffer = await loadTemplate('invoice');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(templateBuffer);

  const worksheet = workbook.getWorksheet(1);
  if (!worksheet) {
    throw new Error('无法获取发票工作表');
  }

  // 1. 替换简单变量
  const totalPairs = formData.items.reduce((sum, item) => {
    return sum + item.colors.reduce((cSum, color) => cSum + color.totalPairs, 0);
  }, 0);

  const firstItem = formData.items[0];

  const simpleVars: Record<string, string | number> = {
    // 发票模板占位符（必须与模板中的 {{...}} 完全匹配）
    'Invoice_company name': formData.companyName || '',
    'Invoice_company adress': formData.companyAddress || '',
    'Invoice_company TEL & FAX ': formData.companyTelFax || '',
    'Invoice_No': formData.invoiceNo || formData.orderNo || '',
    'Invoice_date': new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '.'),
    'Invoice_order no.': formData.orderNo || '',
    'Invoice_arrival place': formData.destination || '',
  };
  replaceSimpleVariables(worksheet, simpleVars);

  // 2. 获取所有尺码
  const allSizes = getAllSizes(formData.items);
  console.log('尺码列表:', allSizes);

  // 3. 动态生成矩阵 - 从第29行开始
  const startRow = 29;
  const styleNoCol = 1;  // A列 - 款式号
  const sizeStartCol = 3; // C列 - 尺码列起始位置
  const pairsPerCartonCol = 9; // I列 - 每箱双数
  const totalPairsCol = 13; // M列 - 总双数
  const unitPriceCol = 14; // N列 - 单价
  const amountCol = 15; // O列 - 金额

  // 清空原有的静态占位符行（29-36行）
  for (let r = startRow; r <= startRow + 10; r++) {
    const row = worksheet.getRow(r);
    for (let c = 1; c <= 20; c++) {
      row.getCell(c).value = undefined;
    }
  }

  // 写入尺码头（第29行）
  const headerRow = worksheet.getRow(startRow);
  headerRow.getCell(styleNoCol).value = 'Style No./Color';
  headerRow.getCell(styleNoCol).alignment = { horizontal: 'center', vertical: 'middle' };

  // 写入各个尺码
  for (let i = 0; i < allSizes.length; i++) {
    const col = sizeStartCol + i;
    headerRow.getCell(col).value = allSizes[i];
    headerRow.getCell(col).alignment = { horizontal: 'center', vertical: 'middle' };
  }

  // Pairs/Carton 列
  headerRow.getCell(pairsPerCartonCol).value = 'Pairs/CTN';
  headerRow.getCell(pairsPerCartonCol).alignment = { horizontal: 'center', vertical: 'middle' };

  // Total Pairs 列
  headerRow.getCell(totalPairsCol).value = 'Total Pairs';
  headerRow.getCell(totalPairsCol).alignment = { horizontal: 'center', vertical: 'middle' };

  // Unit Price 列
  headerRow.getCell(unitPriceCol).value = 'Unit Price(USD)';
  headerRow.getCell(unitPriceCol).alignment = { horizontal: 'center', vertical: 'middle' };

  // Amount 列
  headerRow.getCell(amountCol).value = 'Amount(USD)';
  headerRow.getCell(amountCol).alignment = { horizontal: 'center', vertical: 'middle' };

  // 设置表头样式
  headerRow.eachCell(cell => {
    cell.font = { bold: true };
    setCellBorder(cell, 'thin');
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
  });

  // 4. 动态写入颜色数据行
  let currentRow = startRow + 1;
  const pairsPerCarton = 10;

  for (const item of formData.items) {
    for (const color of item.colors) {
      const sizeMap = getSizeMap(color);
      const dataRow = worksheet.getRow(currentRow);

      // 款式号/颜色
      dataRow.getCell(styleNoCol).value = `${item.styleNo} / ${color.colorName}`;
      dataRow.getCell(styleNoCol).alignment = { horizontal: 'left', vertical: 'middle' };

      // 各尺码数量 - 0值显示为空，避免客户误解
      for (let i = 0; i < allSizes.length; i++) {
        const col = sizeStartCol + i;
        const qty = sizeMap.get(allSizes[i]) || 0;
        // 0值显示为空（但Excel公式仍会将空单元格视为0进行计算）
        dataRow.getCell(col).value = qty === 0 ? '' : qty;
        dataRow.getCell(col).alignment = { horizontal: 'center', vertical: 'middle' };
      }

      // 每箱双数
      dataRow.getCell(pairsPerCartonCol).value = pairsPerCarton;
      dataRow.getCell(pairsPerCartonCol).alignment = { horizontal: 'center', vertical: 'middle' };

      // 总双数 - 使用求和公式
      if (allSizes.length > 0) {
        const sumStartCol = String.fromCharCode(67); // C
        const sumEndCol = String.fromCharCode(67 + allSizes.length - 1);
        dataRow.getCell(totalPairsCol).value = { formula: `SUM(${sumStartCol}${currentRow}:${sumEndCol}${currentRow})` };
      } else {
        dataRow.getCell(totalPairsCol).value = 0;
      }
      dataRow.getCell(totalPairsCol).alignment = { horizontal: 'center', vertical: 'middle' };

      // 单价
      dataRow.getCell(unitPriceCol).value = item.unitPriceUSD;
      dataRow.getCell(unitPriceCol).alignment = { horizontal: 'center', vertical: 'middle' };

      // 金额 - 使用乘法公式
      dataRow.getCell(amountCol).value = { formula: `M${currentRow}*N${currentRow}` };
      dataRow.getCell(amountCol).alignment = { horizontal: 'center', vertical: 'middle' };

      // 设置数据行边框
      dataRow.eachCell(cell => {
        const colNum = typeof cell.col === 'number' ? cell.col : parseInt(cell.col, 10);
        if (colNum <= sizeStartCol + allSizes.length) {
          setCellBorder(cell, 'thin');
        }
      });

      currentRow++;
    }
  }

  // 5. 写入总计行
  const totalRowNum = currentRow;
  const totalRow = worksheet.getRow(totalRowNum);

  totalRow.getCell(styleNoCol).value = 'TOTAL:';
  totalRow.getCell(styleNoCol).font = { bold: true };
  totalRow.getCell(styleNoCol).alignment = { horizontal: 'center', vertical: 'middle' };

  // 各尺码总计
  for (let i = 0; i < allSizes.length; i++) {
    const col = sizeStartCol + i;
    const colLetter = String.fromCharCode(67 + i);
    const sumRange = `${colLetter}${startRow + 1}:${colLetter}${currentRow - 1}`;
    totalRow.getCell(col).value = { formula: `SUM(${sumRange})` };
    totalRow.getCell(col).font = { bold: true };
    totalRow.getCell(col).alignment = { horizontal: 'center', vertical: 'middle' };
  }

  // 总双数总计
  totalRow.getCell(totalPairsCol).value = { formula: `SUM(M${startRow + 1}:M${currentRow - 1})` };
  totalRow.getCell(totalPairsCol).font = { bold: true };
  totalRow.getCell(totalPairsCol).alignment = { horizontal: 'center', vertical: 'middle' };

  // 总计行样式
  totalRow.eachCell(cell => {
    setCellBorder(cell, 'medium');
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
  });

  console.log('=== 发票生成完成 ===');

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * 动态生成箱单
 */
export async function generatePackingList(formData: FormData): Promise<Blob> {
  console.log('=== 开始生成箱单（动态矩阵）===');

  const templateBuffer = await loadTemplate('packing');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(templateBuffer);

  const worksheet = workbook.getWorksheet(1);
  if (!worksheet) {
    throw new Error('无法获取箱单工作表');
  }

  // 1. 替换简单变量 - 箱单模板占位符
  const simpleVars: Record<string, string | number> = {
    Inv_company_name: formData.companyName || '',
    Inv_company_adress: formData.companyAddress || '',
    'Inv_company_TEL&FAX': formData.companyTelFax || '',
    Inv_No: formData.invoiceNo || formData.orderNo || '',
    Invoice_date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '.'),
    Inv_order_no: formData.orderNo || '',
  };
  replaceSimpleVariables(worksheet, simpleVars);

  // 2. 获取所有尺码
  const allSizes = getAllSizes(formData.items);
  console.log('尺码列表:', allSizes);

  // 3. 动态生成矩阵 - 从第23行开始（箱单模板的数据起始行）
  const startRow = 23;
  const styleColorCol = 1;  // A列 - 款式/颜色
  const sizeStartCol = 3;   // C列 - 尺码列起始位置
  const cartonCol = 11;      // K列 - 箱数
  const pairsCol = 12;      // L列 - 双数
  const nwCol = 13;         // M列 - 净重
  const gwCol = 14;         // N列 - 毛重

  // 清空原有的静态占位符行
  for (let r = startRow; r <= startRow + 15; r++) {
    const row = worksheet.getRow(r);
    for (let c = 1; c <= 20; c++) {
      row.getCell(c).value = undefined;
    }
  }

  // 写入尺码头（第23行）
  const headerRow = worksheet.getRow(startRow);
  headerRow.getCell(styleColorCol).value = 'Style No./Color';
  headerRow.getCell(styleColorCol).alignment = { horizontal: 'center', vertical: 'middle' };

  // 写入各个尺码
  for (let i = 0; i < allSizes.length; i++) {
    const col = sizeStartCol + i;
    headerRow.getCell(col).value = allSizes[i];
    headerRow.getCell(col).alignment = { horizontal: 'center', vertical: 'middle' };
  }

  // Cartons 列
  headerRow.getCell(cartonCol).value = 'CTNS';
  headerRow.getCell(cartonCol).alignment = { horizontal: 'center', vertical: 'middle' };

  // Pairs 列
  headerRow.getCell(pairsCol).value = 'PAIRS';
  headerRow.getCell(pairsCol).alignment = { horizontal: 'center', vertical: 'middle' };

  // N.W. 列
  headerRow.getCell(nwCol).value = 'N.W.(KG)';
  headerRow.getCell(nwCol).alignment = { horizontal: 'center', vertical: 'middle' };

  // G.W. 列
  headerRow.getCell(gwCol).value = 'G.W.(KG)';
  headerRow.getCell(gwCol).alignment = { horizontal: 'center', vertical: 'middle' };

  // 设置表头样式
  headerRow.eachCell(cell => {
    cell.font = { bold: true };
    setCellBorder(cell, 'thin');
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
  });

  // 4. 动态写入颜色数据行
  let currentRow = startRow + 1;
  const pairsPerCarton = 10;
  const nwPerCarton = 6;  // 每箱净重 6kg
  const gwPerCarton = 8;  // 每箱毛重 8kg
  let totalCartons = 0;
  let totalPairs = 0;

  for (const item of formData.items) {
    for (const color of item.colors) {
      const sizeMap = getSizeMap(color);
      const dataRow = worksheet.getRow(currentRow);

      // 款式/颜色
      dataRow.getCell(styleColorCol).value = `${item.styleNo} / ${color.colorName}`;
      dataRow.getCell(styleColorCol).alignment = { horizontal: 'left', vertical: 'middle' };

      // 各尺码数量 - 0值显示为空，避免客户误解
      for (let i = 0; i < allSizes.length; i++) {
        const col = sizeStartCol + i;
        const qty = sizeMap.get(allSizes[i]) || 0;
        // 0值显示为空（但Excel公式仍会将空单元格视为0进行计算）
        dataRow.getCell(col).value = qty === 0 ? '' : qty;
        dataRow.getCell(col).alignment = { horizontal: 'center', vertical: 'middle' };
      }

      // 计算该颜色的箱数
      const colorCartons = Math.ceil(color.totalPairs / pairsPerCarton);
      const colorNw = colorCartons * nwPerCarton;
      const colorGw = colorCartons * gwPerCarton;

      // 箱数
      dataRow.getCell(cartonCol).value = colorCartons;
      dataRow.getCell(cartonCol).alignment = { horizontal: 'center', vertical: 'middle' };

      // 双数
      dataRow.getCell(pairsCol).value = color.totalPairs;
      dataRow.getCell(pairsCol).alignment = { horizontal: 'center', vertical: 'middle' };

      // 净重
      dataRow.getCell(nwCol).value = colorNw;
      dataRow.getCell(nwCol).alignment = { horizontal: 'center', vertical: 'middle' };

      // 毛重
      dataRow.getCell(gwCol).value = colorGw;
      dataRow.getCell(gwCol).alignment = { horizontal: 'center', vertical: 'middle' };

      // 设置数据行边框
      dataRow.eachCell(cell => {
        const colNum = typeof cell.col === 'number' ? cell.col : parseInt(cell.col, 10);
        if (colNum <= sizeStartCol + allSizes.length) {
          setCellBorder(cell, 'thin');
        }
      });

      totalCartons += colorCartons;
      totalPairs += color.totalPairs;
      currentRow++;
    }
  }

  // 5. 写入总计行
  const totalRowNum = currentRow;
  const totalRow = worksheet.getRow(totalRowNum);

  totalRow.getCell(styleColorCol).value = 'TOTAL:';
  totalRow.getCell(styleColorCol).font = { bold: true };
  totalRow.getCell(styleColorCol).alignment = { horizontal: 'center', vertical: 'middle' };

  // 箱数总计
  totalRow.getCell(cartonCol).value = totalCartons;
  totalRow.getCell(cartonCol).font = { bold: true };
  totalRow.getCell(cartonCol).alignment = { horizontal: 'center', vertical: 'middle' };

  // 双数总计
  totalRow.getCell(pairsCol).value = totalPairs;
  totalRow.getCell(pairsCol).font = { bold: true };
  totalRow.getCell(pairsCol).alignment = { horizontal: 'center', vertical: 'middle' };

  // 总净重
  totalRow.getCell(nwCol).value = totalCartons * nwPerCarton;
  totalRow.getCell(nwCol).font = { bold: true };
  totalRow.getCell(nwCol).alignment = { horizontal: 'center', vertical: 'middle' };

  // 总毛重
  totalRow.getCell(gwCol).value = totalCartons * gwPerCarton;
  totalRow.getCell(gwCol).font = { bold: true };
  totalRow.getCell(gwCol).alignment = { horizontal: 'center', vertical: 'middle' };

  // 总计行样式
  totalRow.eachCell(cell => {
    setCellBorder(cell, 'medium');
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
  });

  console.log('=== 箱单生成完成 ===');

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * 生成内销合同 Word - 已禁用
 */
export async function generateContract(formData: FormData): Promise<Blob | null> {
  console.log('=== 合同生成已禁用 ===');
  return null;
}

/**
 * 生成所有文档
 */
export async function generateAllDocuments(formData: FormData): Promise<{
  invoice: Blob;
  packingList: Blob;
  contract: Blob | null;
  invoiceName: string;
  packingName: string;
  contractName: string;
  contractError?: string;
}> {
  const orderNo = formData.orderNo || formData.invoiceNo || 'order';
  const dateStr = new Date().toISOString().split('T')[0];

  let invoice: Blob;
  let packingList: Blob;
  let contract: Blob | null = null;

  try {
    invoice = await generateInvoice(formData);
  } catch (err) {
    throw new Error(`发票生成失败: ${err instanceof Error ? err.message : '未知错误'}`);
  }

  try {
    packingList = await generatePackingList(formData);
  } catch (err) {
    throw new Error(`箱单生成失败: ${err instanceof Error ? err.message : '未知错误'}`);
  }

  return {
    invoice,
    packingList,
    contract,
    invoiceName: `Invoice_${orderNo}_${dateStr}.xlsx`,
    packingName: `PackingList_${orderNo}_${dateStr}.xlsx`,
    contractName: `Contract_${orderNo}_${dateStr}.docx`,
    contractError: '合同生成功能已禁用',
  };
}
