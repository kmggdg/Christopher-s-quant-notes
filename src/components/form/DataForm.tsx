"use client";

import { FileText, Package } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useOrder } from "@/context/OrderContext";

export function DataForm() {
  const { formData, updateFormData, parseStatus } = useOrder();

  const handleInputChange = (field: string, value: string | number) => {
    updateFormData(field as any, value);
  };

  // 获取所有唯一的尺码值（按顺序）
  const getAllSizes = () => {
    const sizeSet = new Set<string>();
    formData.items.forEach(item => {
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
  };

  const allSizes = getAllSizes();

  // 计算总计
  const totalPairs = formData.items.reduce((sum, item) => {
    return sum + item.colors.reduce((cSum, color) => cSum + color.totalPairs, 0);
  }, 0);

  const totalAmountUSD = formData.items.reduce((sum, item) => {
    return sum + item.colors.reduce((cSum, color) => {
      return cSum + color.sizes.reduce((sSum, size) => {
        return sSum + (size.quantity * item.unitPriceUSD);
      }, 0);
    }, 0);
  }, 0);

  // 判断是否有数据
  const hasData = formData.companyName || formData.orderNo || formData.items.length > 0;

  console.log('DataForm 渲染: items 数量 =', formData.items.length);
  console.log('DataForm 渲染: allSizes =', allSizes);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          数据核对与补充表单
        </CardTitle>
        <CardDescription>
          核对 Excel 解析数据，补充必要信息后生成单证
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {parseStatus === 'idle' || !hasData ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg">暂无订单数据</p>
            <p className="text-sm mt-2">请先在"文件上传"页面上传 Excel 订单</p>
          </div>
        ) : (
          <>
            {/* 客户信息 - 可编辑 */}
            <div className="space-y-4">
              <div>
                <Label className="text-base font-semibold">客户信息</Label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">客户公司名称</Label>
                  <Input
                    id="companyName"
                    value={formData.companyName}
                    onChange={(e) => handleInputChange("companyName", e.target.value)}
                    placeholder="客户公司名称"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyTelFax">客户电话/传真</Label>
                  <Input
                    id="companyTelFax"
                    value={formData.companyTelFax}
                    onChange={(e) => handleInputChange("companyTelFax", e.target.value)}
                    placeholder="TEL: xxx, FAX: xxx"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="companyAddress">客户地址</Label>
                  <Textarea
                    id="companyAddress"
                    value={formData.companyAddress}
                    onChange={(e) => handleInputChange("companyAddress", e.target.value)}
                    rows={2}
                    placeholder="客户地址"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* 订单信息 - 可编辑 */}
            <div className="space-y-4">
              <div>
                <Label className="text-base font-semibold">订单信息</Label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="orderNo">订单号</Label>
                  <Input
                    id="orderNo"
                    value={formData.orderNo}
                    onChange={(e) => handleInputChange("orderNo", e.target.value)}
                    placeholder="订单号"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">订单日期</Label>
                  <Input
                    id="date"
                    value={formData.date}
                    onChange={(e) => handleInputChange("date", e.target.value)}
                    placeholder="订单日期"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="destination">目的地</Label>
                  <Input
                    id="destination"
                    value={formData.destination}
                    onChange={(e) => handleInputChange("destination", e.target.value)}
                    placeholder="目的地"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deliveryTime">交货期</Label>
                  <Input
                    id="deliveryTime"
                    value={formData.deliveryTime}
                    onChange={(e) => handleInputChange("deliveryTime", e.target.value)}
                    placeholder="交货期"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* 待补充信息 - 可编辑 */}
            <div className="space-y-4">
              <div>
                <Label className="text-base font-semibold">待补充信息</Label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="invoiceNo">发票号</Label>
                  <Input
                    id="invoiceNo"
                    value={formData.invoiceNo}
                    onChange={(e) => handleInputChange("invoiceNo", e.target.value)}
                    placeholder="请输入发票号"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="factoryName">国内供货工厂名称</Label>
                  <Input
                    id="factoryName"
                    value={formData.factoryName}
                    onChange={(e) => handleInputChange("factoryName", e.target.value)}
                    placeholder="请输入供货工厂名称"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purchasePriceCNY">人民币采购单价（元）</Label>
                  <Input
                    id="purchasePriceCNY"
                    type="number"
                    step="0.01"
                    value={formData.purchasePriceCNY || ""}
                    onChange={(e) => handleInputChange("purchasePriceCNY", parseFloat(e.target.value) || 0)}
                    placeholder="请输入采购单价"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentTerms">付款条款</Label>
                  <Input
                    id="paymentTerms"
                    value={formData.paymentTerms}
                    onChange={(e) => handleInputChange("paymentTerms", e.target.value)}
                    placeholder="付款条款"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="packing">包装方式</Label>
                  <Input
                    id="packing"
                    value={formData.packing}
                    onChange={(e) => handleInputChange("packing", e.target.value)}
                    placeholder="包装方式"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* 订单明细表格 - 只读显示 */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">订单明细</Label>
                <span className="text-sm text-muted-foreground">
                  共 {formData.items.length} 个款式，{allSizes.length} 个尺码
                </span>
              </div>

              {formData.items.length > 0 ? (
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[80px]">款式</TableHead>
                        <TableHead className="w-[80px]">颜色</TableHead>
                        {allSizes.map((size, idx) => (
                          <TableHead key={idx} className="w-[50px] text-center">
                            {size}
                          </TableHead>
                        ))}
                        <TableHead className="w-[80px] text-center">总双数</TableHead>
                        <TableHead className="w-[80px] text-center">单价(USD)</TableHead>
                        <TableHead className="w-[100px] text-center">金额(USD)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formData.items.map((item, itemIndex) =>
                        item.colors.map((color, colorIndex) => {
                          // 建立尺码到数量的映射
                          const sizeMap = new Map<string, number>();
                          color.sizes.forEach(s => {
                            sizeMap.set(s.size, s.quantity);
                          });

                          // 计算该颜色的总金额
                          const colorAmount = color.totalPairs * item.unitPriceUSD;

                          console.log(`渲染: item=${item.styleNo}, color=${color.colorName}, totalPairs=${color.totalPairs}`);

                          return (
                            <TableRow key={`${item.id}-${colorIndex}-${itemIndex}`}>
                              {colorIndex === 0 ? (
                                <TableCell className="font-medium" rowSpan={item.colors.length}>
                                  {item.styleNo}
                                </TableCell>
                              ) : null}
                              <TableCell>{color.colorName}</TableCell>
                              {allSizes.map((size, sizeIdx) => (
                                <TableCell key={sizeIdx} className="text-center">
                                  {sizeMap.get(size) || '-'}
                                </TableCell>
                              ))}
                              <TableCell className="text-center font-medium">{color.totalPairs}</TableCell>
                              {colorIndex === 0 ? (
                                <>
                                  <TableCell rowSpan={item.colors.length} className="text-center">
                                    ${item.unitPriceUSD.toFixed(2)}
                                  </TableCell>
                                  <TableCell rowSpan={item.colors.length} className="text-center">
                                    ${colorAmount.toFixed(2)}
                                  </TableCell>
                                </>
                              ) : null}
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground border rounded-lg">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>解析失败，请检查订单文件格式</p>
                </div>
              )}

              {/* 总计 */}
              {formData.items.length > 0 && (
                <div className="grid grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
                  <div className="text-center">
                    <Label className="text-sm text-muted-foreground">总双数</Label>
                    <p className="text-2xl font-bold">{totalPairs}</p>
                  </div>
                  <div className="text-center">
                    <Label className="text-sm text-muted-foreground">总金额(USD)</Label>
                    <p className="text-2xl font-bold">${totalAmountUSD.toFixed(2)}</p>
                  </div>
                  <div className="text-center">
                    <Label className="text-sm text-muted-foreground">总箱数</Label>
                    <p className="text-2xl font-bold">{Math.ceil(totalPairs / 10)}</p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
