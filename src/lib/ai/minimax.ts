/**
 * MiniMax AI API 集成模块
 * 用于智能解析客户订单文件
 */

const MINIMAX_API_URL = 'https://api.minimax.chat/v1/text/chatcompletion_v2';
const MINIMAX_GROUP_ID = process.env.NEXT_PUBLIC_MINIMAX_GROUP_ID || '';
const MINIMAX_API_KEY = process.env.NEXT_PUBLIC_MINIMAX_API_KEY || '';

// 系统提示词 - 指导 AI 解析订单
const SYSTEM_PROMPT = `You are an expert at parsing shoe trade order Excel files from different formats.

## Order Formats:

### Format 1 (FS092, FS097 - FAIRSTONE COMPANY):
- Company info at rows 2-5: Name, Address, TEL/FAX
- Order No at row 8 (e.g., "No. : 750101")
- Date at row 9 (e.g., "Date : 2025-09-19")
- Items in main sheet table at rows 16-20
- Size/Color matrix in Sheet2
- Destination at row 39, Delivery at row 40, Packing at row 41

### Format 2 (KSZ-043, KSZ-047, KSZ-049 - Y.M.T CORPORATION):
- Seller info at rows 1-5 (SHANGHAI ZHIWANG INTERNATIONAL)
- Customer info at rows 11-14 (Y.M.T CORPORATION)
- Order No at row 24 (e.g., "3.ORDER NO: KSZ-2510A")
- Date at row 9
- Items in CONTRACT sheet, multiple styles (rows 30+)
- Size/Color matrix in second sheet
- Packing at row 39/43, Delivery at row 42/46

## Your task:
Extract ALL these fields as JSON:

{
  "companyName": "Client company name",
  "companyAddress": "Full address",
  "companyTelFax": "TEL:xxx,FAX:xxx",
  "orderNo": "Order number",
  "date": "Order date as YYYY-MM-DD",
  "supplierName": "Supplier name",
  "supplierAddress": "Supplier address",
  "items": [
    {
      "styleNo": "Style number",
      "unitPriceUSD": 10.5,
      "colors": [
        {
          "colorName": "BLACK",
          "sizes": [
            {"size": "24.5", "quantity": 100},
            {"size": "25.0", "quantity": 150}
          ],
          "totalPairs": 250
        }
      ]
    }
  ],
  "destination": "Destination port/city",
  "deliveryTime": "Delivery time/date",
  "packing": "Packing method",
  "paymentTerms": "Payment terms",
  "totalPairs": 2500,
  "totalCartons": 250,
  "totalAmountUSD": 25000
}

## CRITICAL REQUIREMENTS:

1. **Size/Color Matrix**: You MUST extract EVERY size and its quantity from the matrix in Sheet2. For each color under each style, list all sizes with quantities.

2. **Calculate totalPairs for EACH color**: Sum all size quantities for that color = color.totalPairs

3. **Calculate totalPairs for EACH item**: Sum all color.totalPairs = item.totalPairs

4. **Date format**: Convert Excel serial (e.g., 45831) to YYYY-MM-DD format

5. **Use ONLY English JSON keys** - never use Chinese keys

6. **Output clean JSON only** - no markdown, no explanations

## ⚠️【极度重要警告：绝对禁止数据错位】⚠️

表格中的尺码（横排表头）和下方的数量是严格按列对齐的！

- 如果某个尺码下方的单元格是 0 或者显示为 ColX:0，说明该尺码的订货量就是 0！
- 你绝对不能跳过空值/0把后面的数字往前挪！
- 请你就像垂直画一条线一样，严格核对每一列的表头和下方的数字！
- 你返回的 JSON sizeBreakdown 必须是明确的 Key-Value 映射结构！
- 例如，你必须返回 {"24.5": 0, "25.0": 120, "25.5": 200}，绝对不能只返回一个没有对应尺码的数组！

**错误的示范**（数据错位）：
{"sizes": [{"size": "24.5", "quantity": 120}, {"size": "25.0", "quantity": 200}]}  ← 把25.0的120双错误地算到了24.5！

**正确的示范**（数据对齐）：
{"sizes": [{"size": "24.5", "quantity": 0}, {"size": "25.0", "quantity": 120}, {"size": "25.5", "quantity": 200}]}  ← 明确0就是0，120就是120！`;

const USER_PROMPT_TEMPLATE = `Parse this order Excel file and output JSON:

{content}`;

export interface MiniMaxMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface MiniMaxRequest {
  model: string;
  messages: MiniMaxMessage[];
  temperature?: number;
  max_tokens?: number;
}

export interface MiniMaxResponse {
  id: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface MiniMaxError {
  error: {
    message: string;
    type: string;
    code?: string;
  };
}

/**
 * 调用 MiniMax API 进行订单解析
 */
export async function parseOrderWithAI(
  excelContent: string,
  fileName: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  if (!MINIMAX_API_KEY || !MINIMAX_GROUP_ID) {
    return {
      success: false,
      error: 'MiniMax API 密钥未配置'
    };
  }

  const messages: MiniMaxMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: USER_PROMPT_TEMPLATE.replace('{content}', excelContent)
    }
  ];

  const requestBody: MiniMaxRequest = {
    model: 'abab6.5s-chat',
    messages,
    temperature: 0.1,
    max_tokens: 4096
  };

  console.log('=== MiniMax API Request ===');
  console.log('URL:', `${MINIMAX_API_URL}?GroupId=${MINIMAX_GROUP_ID}`);

  try {
    const response = await fetch(
      `${MINIMAX_API_URL}?GroupId=${MINIMAX_GROUP_ID}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MINIMAX_API_KEY}`
        },
        body: JSON.stringify(requestBody)
      }
    );

    console.log('=== MiniMax API Response ===');
    console.log('Status:', response.status, response.statusText);

    const responseText = await response.text();
    console.log('Response preview:', responseText.substring(0, 300));

    if (!response.ok) {
      return {
        success: false,
        error: `API 请求失败 (${response.status}): ${responseText.substring(0, 200)}`
      };
    }

    let data: MiniMaxResponse;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      return {
        success: false,
        error: `API 响应 JSON 解析失败: ${responseText.substring(0, 200)}`
      };
    }

    if (!data.choices || !data.choices[0]) {
      return {
        success: false,
        error: `API 响应缺少 choices 字段`
      };
    }

    const content = data.choices[0].message.content;
    console.log('Content:', content.substring(0, 500));

    // 尝试提取 JSON
    try {
      // 去掉可能的 markdown 代码块
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```\w*\n?/, '').replace(/```$/, '');
      }

      const jsonStart = jsonStr.indexOf('{');
      const jsonEnd = jsonStr.lastIndexOf('}') + 1;

      if (jsonStart !== -1 && jsonEnd > jsonStart) {
        jsonStr = jsonStr.substring(jsonStart, jsonEnd);
        const parsedData = JSON.parse(jsonStr);

        console.log('Parsed data:', JSON.stringify(parsedData).substring(0, 1000));

        // 验证必需字段 - 放宽条件，允许空items
        if (!parsedData.companyName || !parsedData.orderNo) {
          console.log('Validation failed - companyName:', parsedData.companyName, 'orderNo:', parsedData.orderNo);
          // 如果有订单号和客户名就返回，即使items为空
          if (parsedData.orderNo && parsedData.companyName) {
            // 确保有items数组
            if (!parsedData.items) {
              parsedData.items = [];
            }
            return {
              success: true,
              data: parsedData
            };
          }
          return {
            success: false,
            error: '解析结果缺少必需字段 (companyName 或 orderNo)'
          };
        }

        // 确保有items数组
        if (!parsedData.items) {
          parsedData.items = [];
        }

        return {
          success: true,
          data: parsedData
        };
      }

      return {
        success: false,
        error: '无法从响应中提取 JSON 数据'
      };
    } catch (parseError) {
      return {
        success: false,
        error: `JSON 解析失败: ${parseError}, 内容: ${content.substring(0, 200)}`
      };
    }
  } catch (error) {
    return {
      success: false,
      error: `网络请求失败: ${error instanceof Error ? error.message : '未知错误'}`
    };
  }
}

/**
 * 检查 API 是否已配置
 */
export function isAIConfigured(): boolean {
  return !!(MINIMAX_API_KEY && MINIMAX_GROUP_ID);
}

/**
 * 获取 API 配置状态信息
 */
export function getAPIStatus(): { configured: boolean; message: string } {
  if (!MINIMAX_API_KEY) {
    return {
      configured: false,
      message: 'MINIMAX_API_KEY 未配置'
    };
  }
  if (!MINIMAX_GROUP_ID) {
    return {
      configured: false,
      message: 'MINIMAX_GROUP_ID 未配置'
    };
  }
  return {
    configured: true,
    message: 'API 已配置'
  };
}
