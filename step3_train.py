"""
Step 3: 轻量级模型训练
- 使用较少的数据进行训练
- 只训练LightGBM (最内存高效)
- 减少boosting轮数
"""
import polars as pl
import lightgbm as lgb
import gc
import os
import numpy as np
import json

print("=" * 60)
print("Step 3: 轻量级模型训练")
print("=" * 60)

DATA_DIR = r"C:\Users\MSI\Desktop\kaggle日内数据"
TRAIN_PATH = os.path.join(DATA_DIR, "train.parquet")
MERGE_MAP_PATH = os.path.join(DATA_DIR, "factor_merge_map.json")
MODEL_DIR = os.path.join(DATA_DIR, "models")
os.makedirs(MODEL_DIR, exist_ok=True)

# 定义特征列
f_cols = [f"f{i}" for i in range(384)]

# 1. 加载因子合并规则
print("\n[1/6] 加载因子合并规则...")
with open(MERGE_MAP_PATH, "r") as f:
    merge_rules = json.load(f)
print(f"  将合并 {len(merge_rules)} 个因子")

# 2. 计算需要保留的特征列
cols_to_drop = list(merge_rules.keys())
remaining_f_cols = [f for f in f_cols if f not in cols_to_drop]
print(f"  保留因子数量: {len(remaining_f_cols)}")

# 定义特征列
feature_cols = remaining_f_cols + ["is_morning_open", "is_afternoon_open"]

# 3. 定义时间切片
print("\n[2/6] 划分时间切片...")
# 使用3个时间段，每个时间段20天
fold_boundaries = [
    (0, 19),       # Fold 1: 前20天
    (120, 139),    # Fold 2: 中间20天
    (240, 259)     # Fold 3: 后20天
]
print(f"  Fold 1: dateid {fold_boundaries[0][0]}-{fold_boundaries[0][1]}")
print(f"  Fold 2: dateid {fold_boundaries[1][0]}-{fold_boundaries[1][1]}")
print(f"  Fold 3: dateid {fold_boundaries[2][0]}-{fold_boundaries[2][1]}")

# 4. 定义模型参数 (轻量版)
lgb_params = {
    'objective': 'regression',
    'metric': 'mse',
    'learning_rate': 0.05,
    'num_leaves': 32,
    'max_depth': 6,
    'feature_fraction': 0.7,
    'n_jobs': 4,  # 限制并行数
    'verbose': -1,
    'seed': 42
}

# 5. 训练循环
print("\n[3/6] 开始训练...")

for fold_idx, (start_date, end_date) in enumerate(fold_boundaries):
    print(f"\n{'='*40}")
    print(f"Fold {fold_idx + 1}: dateid {start_date}-{end_date}")
    print(f"{'='*40}")

    # 5.1 读取当前fold的数据
    print("\n[5.1] 读取训练数据...")

    fold_data = (
        pl.scan_parquet(TRAIN_PATH)
        .filter(pl.col("timeid") < 229)  # 过滤尾盘
        .filter((pl.col("dateid") >= start_date) & (pl.col("dateid") <= end_date))
        .select(["stockid", "dateid", "timeid", "exchangeid"] + f_cols + ["LabelA"])
        .collect()
    )

    # 转换为Float32
    float_cols = f_cols + ["LabelA"]
    fold_data = fold_data.with_columns([
        pl.col(c).cast(pl.Float32) for c in float_cols
    ])

    print(f"  数据形状: {fold_data.shape}")
    gc.collect()

    # 5.2 计算截面均值 (使用后向填充处理NaN)
    print("\n[5.2] 计算截面均值...")

    # 使用 backward_fill() 用后值填充NaN，再用 fill_null(0) 保底
    mean_exprs = [
        pl.col(f).backward_fill().fill_null(0).mean().alias(f"{f}_market_mean")
        for f in f_cols
    ]
    mean_exprs.append(
        pl.col("LabelA").backward_fill().fill_null(0).mean().alias("LabelA_market_mean")
    )

    market_means = fold_data.group_by(["dateid", "timeid"]).agg(mean_exprs)

    # Left join
    fold_data = fold_data.join(market_means, on=["dateid", "timeid"], how="left")

    del market_means
    gc.collect()

    print(f"  加入market_mean后形状: {fold_data.shape}")

    # 5.3 创建时间标识特征
    print("\n[5.3] 创建时间标识特征...")

    fold_data = fold_data.with_columns([
        pl.when(pl.col("timeid") < 15)
        .then(1)
        .otherwise(0)
        .alias("is_morning_open"),

        pl.when((pl.col("timeid") >= 120) & (pl.col("timeid") < 135))
        .then(1)
        .otherwise(0)
        .alias("is_afternoon_open")
    ])

    # 5.4 删除需要合并的因子列
    cols_to_drop_expr = [pl.col(c) for c in cols_to_drop if c in fold_data.columns]
    if cols_to_drop_expr:
        fold_data = fold_data.drop(cols_to_drop_expr)

    # 5.5 准备训练数据
    print("\n[5.4] 准备训练数据...")

    X = fold_data.select(feature_cols).to_numpy()
    y = fold_data.select(["LabelA"]).to_numpy().ravel()

    # 创建样本权重
    timeids = fold_data.select(["timeid"]).to_numpy().ravel()
    weights = np.ones(len(timeids))
    weights[timeids < 15] = 1.5
    weights[(timeids >= 120) & (timeids < 135)] = 1.5

    print(f"  X形状: {X.shape}, y形状: {y.shape}")

    del fold_data, timeids
    gc.collect()

    # 5.6 训练模型
    print("\n[5.5] 训练 LightGBM...")

    lgb_train = lgb.Dataset(X, y, weight=weights, free_raw_data=True)
    lgb_model = lgb.train(
        lgb_params,
        lgb_train,
        num_boost_round=500  # 减少轮数
    )

    # 保存模型
    model_path = os.path.join(MODEL_DIR, f"lgb_fold{fold_idx+1}.pkl")
    import joblib
    joblib.dump(lgb_model, model_path)
    print(f"    模型已保存: {model_path}")

    # 打印特征重要性
    importance = lgb_model.feature_importance(importance_type='gain')
    top_idx = np.argsort(importance)[-10:][::-1]
    print("\n  Top 10 特征重要性:")
    for i in top_idx:
        print(f"    {feature_cols[i]}: {importance[i]:.2f}")

    # 5.7 释放内存
    del X, y, weights
    del lgb_train, lgb_model
    gc.collect()

    print(f"\nFold {fold_idx+1} 训练完成!")

# 6. 保存特征列信息
print("\n[6/6] 保存特征列信息...")
feature_info = {
    "feature_cols": feature_cols,
    "merge_rules": merge_rules
}
with open(os.path.join(MODEL_DIR, "feature_info.json"), "w") as f:
    json.dump(feature_info, f)

print("\n" + "=" * 60)
print("Step 3 完成!")
print(f"模型已保存到: {MODEL_DIR}")
print("=" * 60)
