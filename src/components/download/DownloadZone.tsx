"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, Loader2, Package, FileText, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { FormData } from "@/types/order";
import { generateAllDocuments } from "@/lib/services/documentGenerator";
import { saveAs } from 'file-saver';

interface DownloadZoneProps {
  formData: FormData;
  hasData: boolean;
}

export function DownloadZone({ formData, hasData }: DownloadZoneProps) {
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState({
    invoice: false,
    packing: false,
    contract: false
  });
  const [error, setError] = useState<string | null>(null);

  // 检查必填字段
  const canGenerate = hasData &&
    formData.invoiceNo &&
    formData.factoryName &&
    formData.purchasePriceCNY > 0;

  const handleGenerateAll = async () => {
    if (!canGenerate) {
      setError('请先填写完整信息：发票号、工厂名称、人民币单价');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      console.log('开始生成所有文档...');
      console.log('formData:', JSON.stringify(formData).substring(0, 500));

      const result = await generateAllDocuments(formData);

      // 下载发票
      saveAs(result.invoice, result.invoiceName);
      console.log('发票已下载:', result.invoiceName);

      // 下载箱单
      saveAs(result.packingList, result.packingName);
      console.log('箱单已下载:', result.packingName);

      // 下载合同（如果生成成功）
      if (result.contract) {
        saveAs(result.contract, result.contractName);
        console.log('合同已下载:', result.contractName);
        setGenerated({
          invoice: true,
          packing: true,
          contract: true
        });
      } else {
        console.log('合同生成失败:', result.contractError);
        setGenerated({
          invoice: true,
          packing: true,
          contract: false
        });
        // 显示警告而不是错误
        setError(`发票和箱单已生成成功。合同生成失败: ${result.contractError || '模板格式问题'}`);
      }
    } catch (err) {
      console.error('生成文档失败:', err);
      setError(`生成失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          文件下载区
        </CardTitle>
        <CardDescription>
          订单号：{formData.orderNo || '未指定'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 必填信息检查 */}
        <div className="bg-muted/30 p-4 rounded-lg space-y-2">
          <Label className="font-medium">生成前请确认以下信息已填写：</Label>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="flex items-center gap-2">
              {formData.invoiceNo ? (
                <Badge variant="secondary" className="bg-green-100">✓</Badge>
              ) : (
                <Badge variant="outline">○</Badge>
              )}
              <span>发票号</span>
            </div>
            <div className="flex items-center gap-2">
              {formData.factoryName ? (
                <Badge variant="secondary" className="bg-green-100">✓</Badge>
              ) : (
                <Badge variant="outline">○</Badge>
              )}
              <span>国内工厂</span>
            </div>
            <div className="flex items-center gap-2">
              {formData.purchasePriceCNY > 0 ? (
                <Badge variant="secondary" className="bg-green-100">✓</Badge>
              ) : (
                <Badge variant="outline">○</Badge>
              )}
              <span>人民币单价</span>
            </div>
          </div>
        </div>

        {/* 一键生成按钮 */}
        <div className="space-y-4">
          <Button
            onClick={handleGenerateAll}
            disabled={!canGenerate || generating}
            className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
            size="lg"
          >
            {generating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                正在生成文档...
              </>
            ) : (
              <>
                <Archive className="h-5 w-5" />
                一键生成并下载（发票+箱单+合同）
              </>
            )}
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <Separator />

        {/* 分别生成 */}
        <div className="grid grid-cols-3 gap-4">
          {/* 发票 */}
          <div className="text-center p-4 border rounded-lg">
            <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 text-blue-600" />
            <Label className="block text-sm font-medium">发票 Invoice</Label>
            <p className="text-xs text-muted-foreground mt-1">
              {generated.invoice ? '已生成' : '待生成'}
            </p>
          </div>

          {/* 箱单 */}
          <div className="text-center p-4 border rounded-lg">
            <Package className="h-8 w-8 mx-auto mb-2 text-orange-600" />
            <Label className="block text-sm font-medium">箱单 Packing</Label>
            <p className="text-xs text-muted-foreground mt-1">
              {generated.packing ? '已生成' : '待生成'}
            </p>
          </div>

          {/* 合同 */}
          <div className="text-center p-4 border rounded-lg">
            <FileText className="h-8 w-8 mx-auto mb-2 text-green-600" />
            <Label className="block text-sm font-medium">内销合同 Contract</Label>
            <p className="text-xs text-muted-foreground mt-1">
              {generated.contract ? '已生成' : '待生成'}
            </p>
          </div>
        </div>

        <Separator />

        {/* 说明 */}
        <div className="text-sm text-muted-foreground space-y-2">
          <p className="font-medium">生成说明：</p>
          <ul className="list-disc list-inside space-y-1">
            <li>请先在"数据核对"页面补充完整信息（发票号、工厂名称、人民币单价）</li>
            <li>点击"一键生成"将同时生成发票、箱单和内销合同</li>
            <li>发票和箱单为 Excel 格式，内销合同为 Word 格式</li>
            <li>生成的文件将自动下载到您的电脑</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
