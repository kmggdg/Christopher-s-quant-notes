"use client";

import { useState, useEffect } from "react";
import { FileUploadZone } from "@/components/upload/FileUploadZone";
import { DataForm } from "@/components/form/DataForm";
import { DownloadZone } from "@/components/download/DownloadZone";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderProvider, useOrder } from "@/context/OrderContext";
import { generateAllDocuments } from "@/lib/services/documentGenerator";
import { saveAs } from 'file-saver';

function HomeContent() {
  const [mounted, setMounted] = useState(false);
  const { formData, parseStatus } = useOrder();

  useEffect(() => {
    setMounted(true);
  }, []);

  // 防止服务端/客户端渲染不一致
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white flex items-center justify-center">
        <div className="text-zinc-400">Loading...</div>
      </div>
    );
  }

  const hasData = !!(formData.companyName || formData.orderNo || formData.items.length > 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white" suppressHydrationWarning>
      <div className="container mx-auto py-8 px-4">
        {/* 页面标题 */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-zinc-900">鞋类外贸单证自动化生成系统</h1>
          <p className="text-zinc-500 mt-2">Shoe Trade Document Automation System</p>
        </div>

        {/* 主内容区域 - 使用 Tabs 切换 */}
        <Tabs defaultValue="upload" className="w-full max-w-4xl mx-auto">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="upload" className="text-base py-3">
              1. 文件上传
            </TabsTrigger>
            <TabsTrigger value="form" className="text-base py-3">
              2. 数据核对
            </TabsTrigger>
            <TabsTrigger value="download" className="text-base py-3">
              3. 文件下载
            </TabsTrigger>
          </TabsList>

          {/* 文件上传区 */}
          <TabsContent value="upload">
            <FileUploadZone />
          </TabsContent>

          {/* 数据核对与补充表单区 */}
          <TabsContent value="form">
            <DataForm />
          </TabsContent>

          {/* 文件下载区 */}
          <TabsContent value="download">
            <DownloadZone
              formData={formData}
              hasData={hasData}
            />
          </TabsContent>
        </Tabs>

        {/* 页脚说明 */}
        <div className="mt-12 text-center text-sm text-zinc-400">
          <p>外贸单证自动化生成系统 v1.0</p>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <OrderProvider>
      <HomeContent />
    </OrderProvider>
  );
}
