// 订单数据类型定义

export interface OrderData {
  // 客户信息
  companyName: string;
  companyAddress: string;
  companyTelFax: string;

  // 订单信息
  orderNo: string;
  date: string;

  // 供应商信息
  supplierName: string;
  supplierAddress: string;

  // 商品信息
  items: OrderItem[];

  // 运输信息
  destination: string;
  deliveryTime: string;
  packing: string;
  paymentTerms: string;

  // 计算字段
  totalPairs: number;
  totalCartons: number;
  totalAmountUSD: number;

  // 原始数据
  rawText?: string;
}

export interface OrderItem {
  id: string;
  styleNo: string;
  brand?: string;
  unitPriceUSD: number;
  colors: ColorBreakdown[];
  totalPairs: number;
  totalAmountUSD: number;
}

export interface ColorBreakdown {
  colorName: string;
  sizes: SizeBreakdown[];
  totalPairs: number;
}

export interface SizeBreakdown {
  size: string;
  quantity: number;
}

// AI 解析请求/响应类型
export interface AIParseRequest {
  excelBase64: string;
  fileName: string;
}

export interface AIParseResponse {
  success: boolean;
  data?: OrderData;
  error?: string;
  rawResponse?: string;
}

// 解析状态
export type ParseStatus = 'idle' | 'parsing' | 'success' | 'error';

// 表单数据（用于前端展示）
export interface FormData {
  companyName: string;
  companyAddress: string;
  companyTelFax: string;
  orderNo: string;
  date: string;
  invoiceNo: string;
  factoryName: string;
  purchasePriceCNY: number;
  destination: string;
  deliveryTime: string;
  packing: string;
  paymentTerms: string;
  items: OrderItem[];
}
