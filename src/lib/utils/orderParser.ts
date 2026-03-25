/**
 * 订单解析工具类
 * 使用 xlsx 库读取 Excel 文件并提取文本内容
 */

import * as XLSX from 'xlsx';
import { OrderData, OrderItem, ColorBreakdown, SizeBreakdown } from '@/types/order';

/**
 * 将 Excel 文件转换为 Base64 编码
 * 用于发送给 AI 进行解析
 */
export function excelToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      if (data) {
        // 转换为 Base64（不带前缀）
        const base64 = (data as string).split(',')[1];
        resolve(base64);
      } else {
        reject(new Error('无法读取文件'));
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

/**
 * 将 Excel 文件转换为 Buffer
 */
export function excelToBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      if (data) {
        resolve(data as ArrayBuffer);
      } else {
        reject(new Error('无法读取文件'));
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * 提取 Excel 文件的所有文本内容
 * 返回格式化的文本，供 AI 解析使用
 * 【修复数据错位】使用 defval: 0 强制保留空单元格，确保列对齐
 */
export function extractExcelText(file: File): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      const buffer = await excelToBuffer(file);
      const workbook = XLSX.read(buffer, { type: 'array' });

      let allText = '';
      let sheetIndex = 0;

      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        // 【关键修复】使用 defval: 0 强制空单元格为 0，确保列对齐不错位
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: 0 }) as any[][];

        allText += `\n=== Sheet ${sheetIndex + 1}: ${sheetName} ===\n`;

        // 遍历每一行
        for (let rowIndex = 0; rowIndex < jsonData.length; rowIndex++) {
          const row = jsonData[rowIndex];
          if (!row || row.length === 0) continue;

          // 【关键修复】将行数据转换为文本，空单元格明确显示为 0
          const rowText = row
            .map((cell, colIndex) => {
              // 空单元格、0、null、undefined 都明确显示为 0
              if (cell === null || cell === undefined || cell === '' || cell === 0) {
                return `Col${colIndex}:0`;  // 明确显示为 0
              }
              return `Col${colIndex}:${cell}`;
            })
            .join(' | ');

          if (rowText) {
            allText += `Row ${rowIndex + 1}: ${rowText}\n`;
          }
        }

        sheetIndex++;
      }

      console.log('=== Excel 文本提取结果（用于 AI 解析）===');
      console.log(allText.substring(0, 2000)); // 打印前2000字符供调试
      console.log('...（已截断）');

      resolve(allText);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 基础解析方法 - 使用规则提取（作为 AI 解析的补充）
 * 这个方法尝试使用固定规则来提取数据
 */
export function basicParseOrder(file: File): Promise<OrderData> {
  return new Promise(async (resolve, reject) => {
    try {
      const buffer = await excelToBuffer(file);
      const workbook = XLSX.read(buffer, { type: 'array' });

      // 默认数据结构
      const orderData: OrderData = {
        companyName: '',
        companyAddress: '',
        companyTelFax: '',
        orderNo: '',
        date: '',
        supplierName: '',
        supplierAddress: '',
        items: [],
        destination: '',
        deliveryTime: '',
        packing: '',
        paymentTerms: '',
        totalPairs: 0,
        totalCartons: 0,
        totalAmountUSD: 0
      };

      // 遍历所有 sheet
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        // 遍历每一行，查找关键字段
        for (let rowIndex = 0; rowIndex < jsonData.length; rowIndex++) {
          const row = jsonData[rowIndex];
          if (!row) continue;

          const rowStr = row.join(' ').toUpperCase();

          // 查找订单号
          if (!orderData.orderNo && (rowStr.includes('NO.:') || rowStr.includes('ORDER NO') || rowStr.includes('NO:'))) {
            const match = row.join(' ').match(/(?:NO\.:|ORDER NO|NO:)\s*([A-Z0-9-]+)/i);
            if (match) orderData.orderNo = match[1];
          }

          // 查找日期
          if (!orderData.date && (rowStr.includes('DATE:') || rowStr.includes('DATE'))) {
            const match = row.join(' ').match(/DATE[:\s]*([\d\-\/\.]+)/i);
            if (match) orderData.date = match[1];
          }

          // 查找目的地
          if (!orderData.destination && rowStr.includes('DESTINATION')) {
            const match = row.join(' ').match(/DESTINATION[:\s]*([A-Z\s,]+)/i);
            if (match) orderData.destination = match[1].trim();
          }

          // 查找交货时间
          if (!orderData.deliveryTime && (rowStr.includes('DELIVERY TIME') || rowStr.includes('DELIVERY'))) {
            const match = row.join(' ').match(/(?:DELIVERY TIME)[:\s]*([\w\s,]+)/i);
            if (match) orderData.deliveryTime = match[1].trim();
          }

          // 查找包装方式
          if (!orderData.packing && rowStr.includes('PACKING')) {
            const match = row.join(' ').match(/PACKING[:\s]*(.+)/i);
            if (match) orderData.packing = match[1].trim();
          }

          // 查找付款条款
          if (!orderData.paymentTerms && rowStr.includes('PAYMENT')) {
            const match = row.join(' ').match(/PAYMENT[:\s]*(.+)/i);
            if (match) orderData.paymentTerms = match[1].trim();
          }

          // 查找尺码配比矩阵（通常是 Sheet2）
          if (sheetName.includes('2') || sheetName.toLowerCase().includes('attach') || sheetName.toLowerCase().includes('detail')) {
            // 尝试识别尺码行
            for (let colIndex = 0; colIndex < row.length; colIndex++) {
              const cell = row[colIndex];
              if (cell && /^\d{2}\.\d$/.test(String(cell).trim())) {
                // 这可能是尺码行，尝试解析颜色和数量
                const sizes: string[] = [];
                const quantities: number[] = [];

                // 提取尺码
                for (let i = colIndex; i < row.length && i < colIndex + 10; i++) {
                  const val = row[i];
                  if (val && /^\d{2}\.\d$/.test(String(val).trim())) {
                    sizes.push(String(val).trim());
                  }
                }

                // 如果找到尺码，尝试从上一行获取颜色名
                if (sizes.length > 0 && rowIndex > 0) {
                  const prevRow = jsonData[rowIndex - 1];
                  if (prevRow) {
                    const colorMatch = prevRow.join(' ').match(/([A-Z]+):?/);
                    if (colorMatch) {
                      const colorName = colorMatch[1];
                      const colorItem: ColorBreakdown = {
                        colorName,
                        sizes: [],
                        totalPairs: 0
                      };

                      // 提取数量
                      let totalPairs = 0;
                      for (let i = 0; i < sizes.length && (colIndex + i) < row.length; i++) {
                        const qty = parseInt(row[colIndex + i]) || 0;
                        if (qty > 0) {
                          colorItem.sizes.push({
                            size: sizes[i],
                            quantity: qty
                          });
                          totalPairs += qty;
                        }
                      }
                      colorItem.totalPairs = totalPairs;

                      // 如果当前款式不存在，创建一个新款式
                      if (orderData.items.length === 0) {
                        orderData.items.push({
                          id: '1',
                          styleNo: 'Unknown',
                          unitPriceUSD: 0,
                          colors: [colorItem],
                          totalPairs: totalPairs,
                          totalAmountUSD: 0
                        });
                      } else {
                        orderData.items[0].colors.push(colorItem);
                        orderData.items[0].totalPairs += totalPairs;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      // 计算总数
      orderData.totalPairs = orderData.items.reduce((sum, item) => sum + item.totalPairs, 0);
      orderData.totalCartons = Math.ceil(orderData.totalPairs / 10);

      resolve(orderData);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 验证 OrderData 是否包含必需字段
 */
export function validateOrderData(data: OrderData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.companyName) errors.push('缺少客户公司名称');
  if (!data.orderNo) errors.push('缺少订单号');
  if (!data.destination) errors.push('缺少目的地');
  if (!data.deliveryTime) errors.push('缺少交货时间');
  if (data.items.length === 0) errors.push('缺少商品信息');

  // 检查是否有颜色尺码数据（通过计算得出总双数）
  const hasSizeData = data.items.some(item =>
    item.colors.some(color =>
      color.sizes.some(size => size.quantity > 0)
    )
  );
  if (!hasSizeData) errors.push('缺少尺码数量信息');

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 将 OrderData 转换为表单数据格式
 */
export function orderDataToFormData(data: OrderData) {
  console.log('=== orderDataToFormData 开始转换 ===');
  console.log('原始数据 items 数量:', data.items.length);
  if (data.items.length > 0) {
    console.log('第一个 item:', JSON.stringify(data.items[0]).substring(0, 300));
  }

  // 处理每个颜色，确保有 totalPairs 和 id
  const itemsWithCalculatedPairs = data.items.map((item, index) => {
    // 处理每个颜色，计算 totalPairs
    const processedColors = item.colors.map(color => {
      // 从 sizes 计算 totalPairs
      const colorTotalPairs = color.sizes.reduce((sum, size) => sum + (size.quantity || 0), 0);
      console.log(`颜色 ${color.colorName}: sizes=${color.sizes.length}, 计算得totalPairs=${colorTotalPairs}`);
      return {
        ...color,
        totalPairs: color.totalPairs || colorTotalPairs
      };
    });

    // 计算款式总双数
    const itemTotalPairs = processedColors.reduce((sum, color) => sum + color.totalPairs, 0);
    console.log(`款式 ${item.styleNo}: 颜色数=${processedColors.length}, totalPairs=${itemTotalPairs}`);

    return {
      ...item,
      id: item.id || `item-${index}-${Date.now()}`,
      colors: processedColors,
      totalPairs: itemTotalPairs,
      totalAmountUSD: itemTotalPairs * item.unitPriceUSD
    };
  });

  const result = {
    companyName: data.companyName,
    companyAddress: data.companyAddress,
    companyTelFax: data.companyTelFax,
    orderNo: data.orderNo,
    date: data.date,
    invoiceNo: '',
    factoryName: '',
    purchasePriceCNY: 0,
    destination: data.destination,
    deliveryTime: data.deliveryTime,
    packing: data.packing,
    paymentTerms: data.paymentTerms,
    items: itemsWithCalculatedPairs
  };

  console.log('=== orderDataToFormData 转换完成 ===');
  console.log('转换后 items:', JSON.stringify(result.items).substring(0, 500));

  return result;
}
