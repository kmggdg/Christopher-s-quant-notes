"use client";

import { useState, useCallback, useEffect } from "react";
import { Upload, FileSpreadsheet, X, CheckCircle, Loader2, AlertCircle, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useOrder } from "@/context/OrderContext";

interface UploadedFile {
  name: string;
  size: number;
  lastModified: number;
  status: "pending" | "parsing" | "success" | "error";
  message?: string;
}

export function FileUploadZone() {
  const { handleFileUpload, parseStatus, parseError, aiConfigured, recommendedMethod, uploadedFileName, useAIMode, setUseAIMode } = useOrder();
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [selectedOrderFile, setSelectedOrderFile] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // 等待客户端渲染完成后再显示 AI 状态，避免水合错误
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files[0]);
    }
  };

  const handleFiles = async (file: File) => {
    const newFile: UploadedFile = {
      name: file.name,
      size: file.size,
      lastModified: file.lastModified,
      status: "parsing",
    };

    setUploadedFiles((prev) => [newFile]);
    setSelectedOrderFile(file.name);

    // 调用解析
    await handleFileUpload(file);

    // 更新状态
    setUploadedFiles((prev) =>
      prev.map((f) =>
        f.name === file.name
          ? {
              ...f,
              status: parseStatus === "success" ? "success" : parseStatus === "error" ? "error" : "parsing",
              message: parseError || undefined,
            }
          : f
      )
    );
  };

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
    if (selectedOrderFile === uploadedFiles[index].name) {
      setSelectedOrderFile(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          文件上传区
        </CardTitle>
        <CardDescription>
          请上传外商的 Excel 订单文件（.xlsx, .xls）
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* AI 配置状态和开关 - 只在客户端渲染后显示 */}
        {mounted && (
          <div className="space-y-3">
            {/* 状态提示 */}
            <div className={`text-sm p-3 rounded-lg ${aiConfigured ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
              <div className="flex items-center gap-2">
                {aiConfigured ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                )}
                <span className={aiConfigured ? 'text-green-700' : 'text-amber-700'}>
                  API 状态：{aiConfigured ? '已配置' : '未配置'}
                  {!aiConfigured && '（配置后可通过下方开关启用 AI 解析）'}
                </span>
              </div>
            </div>

            {/* AI 解析模式开关 */}
            <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-blue-600" />
                <div>
                  <Label className="text-sm font-medium text-blue-900">AI 智能解析模式</Label>
                  <p className="text-xs text-blue-700">
                    {useAIMode ? '启用 - 使用 MiniMax AI 智能识别订单' : '关闭 - 使用基础规则解析'}
                  </p>
                </div>
              </div>
              <Button
                variant={useAIMode ? "default" : "outline"}
                size="sm"
                onClick={() => setUseAIMode(!useAIMode)}
                disabled={!aiConfigured}
                className={useAIMode ? "bg-blue-600 hover:bg-blue-700" : ""}
              >
                {useAIMode ? "已开启" : "开启"}
              </Button>
            </div>
          </div>
        )}

        {/* 拖拽上传区域 */}
        <div
          className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <Input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileInput}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={parseStatus === "parsing"}
          />
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-10 w-10 text-muted-foreground" />
            <div className="text-sm text-muted-foreground">
              <span className="font-semibold text-primary">点击上传</span>
              {" 或拖拽文件到此处"}
            </div>
            <p className="text-xs text-muted-foreground">
              支持 .xlsx, .xls 格式
            </p>
            {useAIMode && mounted && aiConfigured && (
              <Badge variant="outline" className="mt-2 bg-blue-50 text-blue-700">
                <Brain className="h-3 w-3 mr-1" />
                AI 解析模式
              </Badge>
            )}
          </div>
        </div>

        {/* 解析状态 */}
        {parseStatus === "parsing" && (
          <div className="flex items-center justify-center p-4 bg-blue-50 rounded-lg">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600 mr-2" />
            <span className="text-blue-700">
              {useAIMode ? 'AI 智能解析中，请稍候...' : '正在解析订单，请稍候...'}
            </span>
          </div>
        )}

        {parseStatus === "success" && uploadedFileName && (
          <div className="flex items-center justify-center p-4 bg-green-50 rounded-lg">
            <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
            <span className="text-green-700">解析成功！请切换到"数据核对"页面查看详情</span>
          </div>
        )}

        {parseStatus === "error" && parseError && (
          <div className="flex flex-col gap-2 p-4 bg-red-50 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
              <span className="text-red-700">解析失败：{parseError}</span>
            </div>
            {aiConfigured && !useAIMode && (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUseAIMode(true)}
                  className="text-blue-600 border-blue-300 hover:bg-blue-50"
                >
                  <Brain className="h-4 w-4 mr-2" />
                  尝试 AI 智能解析
                </Button>
              </div>
            )}
          </div>
        )}

        {/* 已上传文件列表 */}
        {uploadedFiles.length > 0 && (
          <div className="space-y-4">
            <Separator />
            <div className="space-y-2">
              <Label>已上传文件</Label>
              <div className="space-y-2">
                {uploadedFiles.map((file, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      selectedOrderFile === file.name
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {file.status === "parsing" ? (
                        <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                      ) : file.status === "success" ? (
                        <FileSpreadsheet className="h-5 w-5 text-green-600" />
                      ) : file.status === "error" ? (
                        <AlertCircle className="h-5 w-5 text-red-600" />
                      ) : (
                        <FileSpreadsheet className="h-5 w-5 text-gray-600" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(file.size)}
                          {file.status === "parsing" && " - 解析中..."}
                          {file.status === "success" && " - 解析成功"}
                          {file.status === "error" && file.message && ` - ${file.message}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedOrderFile === file.name && file.status === "success" && (
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          已解析
                        </Badge>
                      )}
                      {selectedOrderFile === file.name && file.status === "parsing" && (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          解析中
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFile(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 说明 */}
        {uploadedFiles.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-4">
            <p>请上传包含以下信息的 Excel 文件：</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>订单号</li>
              <li>款式</li>
              <li>颜色</li>
              <li>尺码配比矩阵</li>
              <li>美金单价</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
