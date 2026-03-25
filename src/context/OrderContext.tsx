"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { OrderData, FormData, ParseStatus } from '@/types/order';
import { parseOrder, parseOrderWithAIOnly, getParseServiceStatus } from '@/lib/services/orderParser';

interface OrderContextType {
  // 状态
  orderData: OrderData | null;
  formData: FormData;
  parseStatus: ParseStatus;
  parseError: string | null;
  uploadedFileName: string | null;

  // AI 模式开关
  useAIMode: boolean;
  setUseAIMode: (value: boolean) => void;

  // 服务状态
  aiConfigured: boolean;
  aiMessage: string;
  recommendedMethod: string;

  // 方法
  handleFileUpload: (file: File) => Promise<void>;
  updateFormData: (field: keyof FormData, value: any) => void;
  updateItemField: (itemIndex: number, colorIndex: number, field: string, value: any) => void;
  updateSizeQuantity: (itemIndex: number, colorIndex: number, sizeKey: string, value: number) => void;
  resetOrder: () => void;
}

const defaultFormData: FormData = {
  companyName: '',
  companyAddress: '',
  companyTelFax: '',
  orderNo: '',
  date: '',
  invoiceNo: '',
  factoryName: '',
  purchasePriceCNY: 0,
  destination: '',
  deliveryTime: '',
  packing: '',
  paymentTerms: '',
  items: []
};

const OrderContext = createContext<OrderContextType | undefined>(undefined);

export function OrderProvider({ children }: { children: ReactNode }) {
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [parseStatus, setParseStatus] = useState<ParseStatus>('idle');
  const [parseError, setParseError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [useAIMode, setUseAIMode] = useState(false);

  // 获取服务状态
  const serviceStatus = getParseServiceStatus();

  const handleFileUpload = useCallback(async (file: File) => {
    setParseStatus('parsing');
    setParseError(null);
    setUploadedFileName(file.name);

    try {
      let result;

      if (useAIMode) {
        // 强制使用 AI 解析
        result = await parseOrderWithAIOnly(file);
      } else {
        // 普通解析（AI 或基础）
        result = await parseOrder(file);
      }

      console.log('=== 解析结果 ===');
      console.log('success:', result.success);
      console.log('formData items:', JSON.stringify(result.formData?.items).substring(0, 500));
      console.log('error:', result.error);

      if (result.success && result.formData) {
        setOrderData(result.data || null);
        setFormData(result.formData);
        setParseStatus('success');
      } else {
        setParseStatus('error');
        setParseError(result.error || '解析失败');
      }
    } catch (error) {
      setParseStatus('error');
      setParseError(error instanceof Error ? error.message : '未知错误');
    }
  }, [useAIMode]);

  const updateFormData = useCallback((field: keyof FormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  // 更新商品明细的某个字段
  const updateItemField = useCallback((itemIndex: number, colorIndex: number, field: string, value: any) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      if (newItems[itemIndex]) {
        if (field === 'unitPriceUSD') {
          newItems[itemIndex] = { ...newItems[itemIndex], unitPriceUSD: value };
        } else if (field === 'totalPairs' && newItems[itemIndex].colors[colorIndex]) {
          newItems[itemIndex].colors[colorIndex] = { ...newItems[itemIndex].colors[colorIndex], totalPairs: value };
        }
      }
      return { ...prev, items: newItems };
    });
  }, []);

  // 更新某个尺码的数量
  const updateSizeQuantity = useCallback((itemIndex: number, colorIndex: number, sizeKey: string, value: number) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      if (newItems[itemIndex] && newItems[itemIndex].colors[colorIndex]) {
        const color = newItems[itemIndex].colors[colorIndex];
        const newSizes = [...color.sizes];
        const sizeIndex = newSizes.findIndex(s => s.size === sizeKey);
        if (sizeIndex >= 0) {
          newSizes[sizeIndex] = { ...newSizes[sizeIndex], quantity: value };
        } else {
          newSizes.push({ size: sizeKey, quantity: value });
        }
        // 重新计算该颜色的总双数
        const totalPairs = newSizes.reduce((sum, s) => sum + s.quantity, 0);
        newItems[itemIndex].colors[colorIndex] = { ...color, sizes: newSizes, totalPairs };
      }
      return { ...prev, items: newItems };
    });
  }, []);

  const resetOrder = useCallback(() => {
    setOrderData(null);
    setFormData(defaultFormData);
    setParseStatus('idle');
    setParseError(null);
    setUploadedFileName(null);
  }, []);

  const value: OrderContextType = {
    orderData,
    formData,
    parseStatus,
    parseError,
    uploadedFileName,
    useAIMode,
    setUseAIMode,
    aiConfigured: serviceStatus.aiConfigured,
    aiMessage: serviceStatus.aiMessage,
    recommendedMethod: serviceStatus.recommendedMethod,
    handleFileUpload,
    updateFormData,
    updateItemField,
    updateSizeQuantity,
    resetOrder
  };

  return (
    <OrderContext.Provider value={value}>
      {children}
    </OrderContext.Provider>
  );
}

export function useOrder() {
  const context = useContext(OrderContext);
  if (context === undefined) {
    throw new Error('useOrder must be used within an OrderProvider');
  }
  return context;
}
