/**
 * 订单 AI 解析服务
 * 整合 AI 解析和基础解析，提供智能订单解析功能
 */

import { OrderData, AIParseResponse } from '@/types/order';
import {
  extractExcelText,
  excelToBase64,
  basicParseOrder,
  validateOrderData,
  orderDataToFormData
} from '@/lib/utils/orderParser';
import { parseOrderWithAI, isAIConfigured, getAPIStatus } from '@/lib/ai/minimax';

export interface ParseResult {
  success: boolean;
  data?: OrderData;
  error?: string;
  useAI?: boolean;
  formData?: ReturnType<typeof orderDataToFormData>;
}

/**
 * 主解析函数 - 智能选择解析方式
 * 1. 如果 AI 已配置，使用 AI 解析
 * 2. 否则使用基础规则解析
 */
export async function parseOrder(file: File): Promise<ParseResult> {
  try {
    // 检查是否配置了 AI
    const aiConfigured = isAIConfigured();

    if (aiConfigured) {
      console.log('使用 AI 解析订单...');

      // 提取 Excel 文本内容
      const excelText = await extractExcelText(file);
      console.log('Excel 内容已提取，字符数:', excelText.length);

      // 调用 AI 解析
      const aiResult = await parseOrderWithAI(excelText, file.name);

      if (aiResult.success && aiResult.data) {
        console.log('AI 解析成功，数据:', JSON.stringify(aiResult.data).substring(0, 500));

        // 验证解析结果
        const validation = validateOrderData(aiResult.data);
        console.log('验证结果:', validation);

        if (validation.valid) {
          return {
            success: true,
            data: aiResult.data,
            useAI: true,
            formData: orderDataToFormData(aiResult.data)
          };
        } else {
          console.warn('AI 解析结果验证失败，尝试基础解析:', validation.errors);
        }
      } else {
        console.warn('AI 解析失败，尝试基础解析:', aiResult.error);
      }
    }

    // 如果 AI 未配置或解析失败，使用基础解析
    console.log('使用基础规则解析订单...');
    const basicData = await basicParseOrder(file);

    const validation = validateOrderData(basicData);
    if (!validation.valid) {
      return {
        success: false,
        error: `解析失败: ${validation.errors.join(', ')}`
      };
    }

    return {
      success: true,
      data: basicData,
      useAI: false,
      formData: orderDataToFormData(basicData)
    };
  } catch (error) {
    console.error('订单解析错误:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知解析错误'
    };
  }
}

/**
 * 仅使用基础规则解析（不调用 AI）
 */
export async function parseOrderBasic(file: File): Promise<ParseResult> {
  try {
    const data = await basicParseOrder(file);

    const validation = validateOrderData(data);
    if (!validation.valid) {
      return {
        success: false,
        error: `解析失败: ${validation.errors.join(', ')}`
      };
    }

    return {
      success: true,
      data,
      useAI: false,
      formData: orderDataToFormData(data)
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知解析错误'
    };
  }
}

/**
 * 强制使用 AI 解析
 */
export async function parseOrderWithAIOnly(file: File): Promise<ParseResult> {
  const status = getAPIStatus();

  if (!status.configured) {
    return {
      success: false,
      error: status.message
    };
  }

  try {
    const excelText = await extractExcelText(file);
    const aiResult = await parseOrderWithAI(excelText, file.name);

    if (aiResult.success && aiResult.data) {
      return {
        success: true,
        data: aiResult.data,
        useAI: true,
        formData: orderDataToFormData(aiResult.data)
      };
    }

    return {
      success: false,
      error: aiResult.error || 'AI 解析失败'
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    };
  }
}

/**
 * 获取解析服务状态
 */
export function getParseServiceStatus() {
  const aiStatus = getAPIStatus();
  return {
    aiConfigured: aiStatus.configured,
    aiMessage: aiStatus.message,
    recommendedMethod: aiStatus.configured ? 'AI 智能解析' : '基础规则解析'
  };
}
