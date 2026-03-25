"""
Step 2: 因子相关性分析与加权合并
- 内存友好的相关性计算
- 找出高度共线性因子对 (|r| > 0.90)
- 生成加权合并规则
"""
import polars as pl
import gc
import os
import numpy as np
import json

print("=" * 60)
print("Step 2: 因子相关性分析与合并")
print("=" * 60)

DATA_DIR = r"C:\Users\MSI\Desktop\kaggle日内数据"
TRAIN_PATH = os.path.join(DATA_DIR, "train.parquet")
OUTPUT_JSON = os.path.join(DATA_DIR, "factor_merge_map.json")

# 定义特征列
f_cols = [f"f{i}" for i in range(384)]

# 1. 读取部分数据进行分析 (抽取约3%的数据)
print("\n[1/5] 读取部分数据进行相关性分析...")
print("  策略: 抽取连续10个交易日")

# 读取10天的数据 (约 1.1M 行)
sample_data = (
    pl.scan_parquet(TRAIN_PATH)
    .filter(pl.col("dateid") < 10)  # 只取前10天
    .filter(pl.col("timeid") < 229)   # 过滤尾盘
    .select(["dateid", "timeid", "LabelA"] + f_cols)
    .collect()
)

print(f"  样本数据形状: {sample_data.shape}")

# 2. 转换为Float32以节省内存
print("\n[2/5] 转换为Float32...")
sample_data = sample_data.with_columns([
    pl.col(c).cast(pl.Float32) for c in f_cols + ["LabelA"]
])

# 3. 计算各因子与LabelA的相关性 (用于确定合并权重)
print("\n[3/5] 计算因子与LabelA的相关性...")

# 转换为pandas来计算 (更高效)
pdf = sample_data.select(f_cols + ["LabelA"]).to_pandas()

# 释放polars数据
del sample_data
gc.collect()

label_corrs = {}
for f in f_cols:
    corr = pdf[f].corr(pdf["LabelA"])
    label_corrs[f] = corr if not np.isnan(corr) else 0.0

print(f"  计算完成，共 {len(label_corrs)} 个因子")

# 4. 计算因子间的相关性矩阵
print("\n[4/5] 计算因子间相关性矩阵...")

# 计算相关性矩阵
corr_matrix = pdf[f_cols].corr()

print(f"  相关性矩阵形状: {corr_matrix.shape}")

# 释放用于计算label相关的内存，但保留相关性矩阵
gc.collect()

# 5. 找出高度共线性因子对并生成合并规则
print("\n[5/5] 识别高度共线性因子对...")

# 阈值
CORR_THRESHOLD = 0.90

# 存储合并规则
merge_rules = {}
processed = set()

for i, col1 in enumerate(f_cols):
    if col1 in processed:
        continue

    for j, col2 in enumerate(f_cols):
        if i >= j:
            continue  # 只看上三角

        corr_val = abs(corr_matrix.loc[col1, col2])

        if corr_val > CORR_THRESHOLD:
            # 找到高度相关因子对
            # 基于与LabelA的相关性决定权重
            corr1 = abs(label_corrs[col1])
            corr2 = abs(label_corrs[col2])

            total_corr = corr1 + corr2
            if total_corr > 0:
                w1 = corr1 / total_corr
                w2 = corr2 / total_corr
            else:
                w1, w2 = 0.5, 0.5

            # 保留col1 (与LabelA相关性更高的)，将col2合并进去
            merge_rules[col2] = {
                "keep": col1,
                "merge_to": col1,
                "weight_self": w2,
                "weight_target": w1,
                "correlation": float(corr_val)
            }
            processed.add(col2)

            print(f"  {col1} <-> {col2}: r={corr_val:.4f}, 保留{col1}, 合并{col2}")

# 释放相关性矩阵
del corr_matrix, label_corrs
gc.collect()

# 6. 保存合并规则
print(f"\n共识别 {len(merge_rules)} 个需要合并的因子")

# 保存为JSON
with open(OUTPUT_JSON, "w") as f:
    json.dump(merge_rules, f, indent=2)

print(f"合并规则已保存到: {OUTPUT_JSON}")

# 7. 生成最终保留的因子列表
remaining_f_cols = [f for f in f_cols if f not in merge_rules]
print(f"\n最终保留因子数量: {len(remaining_f_cols)} (原始: {len(f_cols)})")
print(f"因子数量减少: {len(f_cols) - len(remaining_f_cols)} 个")

print("\n" + "=" * 60)
print("Step 2 完成!")
print("=" * 60)
