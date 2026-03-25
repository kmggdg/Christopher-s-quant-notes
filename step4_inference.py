"""
Step 4: 测试集推理脚本 (内存优化版)
- 分批处理测试数据
- 加载3个fold的LightGBM模型
- 生成submission.csv
"""
import polars as pl
import lightgbm as lgb
import joblib
import gc
import os
import numpy as np
import json
import pandas as pd

print("=" * 60)
print("Step 4: 测试集推理 (内存优化版)")
print("=" * 60)

DATA_DIR = r"C:\Users\MSI\Desktop\kaggle日内数据"
TEST_PATH = os.path.join(DATA_DIR, "test.parquet")
MODEL_DIR = os.path.join(DATA_DIR, "models")
FEATURE_INFO_PATH = os.path.join(MODEL_DIR, "feature_info.json")
OUTPUT_PATH = os.path.join(DATA_DIR, "submission.csv")

# 定义特征列
f_cols = [f"f{i}" for i in range(384)]

# 1. 加载特征信息
print("\n[1/5] 加载特征信息...")
with open(FEATURE_INFO_PATH, "r") as f:
    feature_info = json.load(f)

feature_cols = feature_info["feature_cols"]
merge_rules = feature_info["merge_rules"]
cols_to_drop = list(merge_rules.keys())

print(f"  特征数量: {len(feature_cols)}")
print(f"  需删除的列: {len(cols_to_drop)}")

# 2. 加载模型
print("\n[2/5] 加载模型...")
models = []
for fold_idx in range(1, 4):
    model_path = os.path.join(MODEL_DIR, f"lgb_fold{fold_idx}.pkl")
    model = joblib.load(model_path)
    models.append(model)
    print(f"  已加载: lgb_fold{fold_idx}.pkl")

# 3. 分批处理测试数据
print("\n[3/5] 分批处理测试数据...")

# 获取测试数据的日期范围
test_schema = pl.scan_parquet(TEST_PATH).select(["dateid"]).collect()
max_dateid = int(test_schema["dateid"].max())
min_dateid = int(test_schema["dateid"].min())
del test_schema
gc.collect()

print(f"  测试集日期范围: {min_dateid} - {max_dateid}")

# 分批处理，每批10天
batch_size = 10
all_predictions = []
all_ids = []

for start_date in range(0, max_dateid + 1, batch_size):
    end_date = min(start_date + batch_size, max_dateid + 1)
    print(f"\n  处理日期块: {start_date} - {end_date-1}")

    # 读取当前批次的测试数据 (包含所有 timeid 0-238)
    test_data = (
        pl.scan_parquet(TEST_PATH)
        .filter(pl.col("timeid") < 239)
        .filter((pl.col("dateid") >= start_date) & (pl.col("dateid") < end_date))
        .collect()
    )

    # 转换为Float32
    float_cols = [c for c in f_cols if c in test_data.columns]
    test_data = test_data.with_columns([
        pl.col(c).cast(pl.Float32) for c in float_cols
    ])

    # 计算截面均值 (使用后向填充处理NaN)
    mean_exprs = [
        pl.col(f).backward_fill().fill_null(0).mean().alias(f"{f}_market_mean")
        for f in f_cols
    ]
    market_means = test_data.group_by(["dateid", "timeid"]).agg(mean_exprs)
    test_data = test_data.join(market_means, on=["dateid", "timeid"], how="left")

    del market_means
    gc.collect()

    # 创建时间标识特征
    test_data = test_data.with_columns([
        pl.when(pl.col("timeid") < 15)
        .then(1)
        .otherwise(0)
        .alias("is_morning_open"),

        pl.when((pl.col("timeid") >= 120) & (pl.col("timeid") < 135))
        .then(1)
        .otherwise(0)
        .alias("is_afternoon_open")
    ])

    # 删除需要合并的因子列
    cols_to_drop_expr = [pl.col(c) for c in cols_to_drop if c in test_data.columns]
    if cols_to_drop_expr:
        test_data = test_data.drop(cols_to_drop_expr)

    # 确保所有特征列都存在
    missing_cols = [c for c in feature_cols if c not in test_data.columns]
    if missing_cols:
        for c in missing_cols:
            test_data = test_data.with_columns(pl.lit(0.0).alias(c))

    # 准备特征矩阵
    X_test = test_data.select(feature_cols).to_numpy()

    # 保存ID列
    ids = test_data.select(["stockid", "dateid", "timeid"]).to_pandas()

    del test_data
    gc.collect()

    # 预测
    predictions = np.zeros(len(X_test))
    for model in models:
        predictions += model.predict(X_test)
    predictions /= len(models)

    all_predictions.append(predictions)
    all_ids.append(ids)

    del X_test
    gc.collect()

    print(f"    完成 {end_date}/{max_dateid+1} 天")

# 合并所有批次
print("\n[4/5] 合并预测结果...")
all_predictions = np.concatenate(all_predictions)
all_ids = pd.concat(all_ids, ignore_index=True)

# 5. 生成提交文件
print("\n[5/5] 生成提交文件...")

# 创建提交DataFrame
submission = all_ids.copy()
submission["prediction"] = all_predictions

# 按照要求的格式排列 - 合并为 Uid|stockid|dateid|timeid 格式
submission = submission.sort_values(["stockid", "dateid", "timeid"])
submission["Uid"] = submission["stockid"].astype(str) + "|" + submission["dateid"].astype(str) + "|" + submission["timeid"].astype(str)
submission = submission[["Uid", "prediction"]]

# 保存
submission.to_csv(OUTPUT_PATH, index=False)
print(f"  提交文件已保存: {OUTPUT_PATH}")
print(f"  行数: {len(submission)}")

# 预览
print("\n提交文件预览:")
print(submission.head(10))

print("\n" + "=" * 60)
print("Step 4 完成!")
print("=" * 60)
