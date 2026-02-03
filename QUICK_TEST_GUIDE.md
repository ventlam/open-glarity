# 快速测试指南

## ✅ 已完成的改进

### 1. 摘要缓存
- 折叠/展开不再重新生成
- 缓存 24 小时

### 2. Token 预算优化
- 大幅增加 prompt 和 output 预留值
- 适配您的复杂 prompt

### 3. 分段总结（核心功能）
- 自动检测长视频
- 多次 API 调用
- 显示进度条
- 完整覆盖内容

## 🔄 现在开始测试

### 步骤 1：重新加载扩展

1. 打开 `chrome://extensions/`
2. 找到 "Glarity Summary" 扩展
3. 点击刷新按钮 🔄

### 步骤 2：测试您的 10 分钟视频

1. 打开浏览器开发者工具（F12）
2. 访问测试视频
3. 点击 Glarity 生成摘要

### 步骤 3：查看控制台日志

**关键信息**：

```
[Glarity] Transcript Analysis:
    Total tokens: X,XXX          ← 实际字幕 token 数
    Available tokens: XXX,XXX    ← 可用空间
    Usage: XX%                   ← 使用率

[Glarity] ✅ 或 ⚠️              ← 使用哪种模式
```

## 📊 预期行为

### 场景 A：单段模式（快速）

**条件**：字幕 tokens < 可用空间的 50%

**日志**：
```
[Glarity] ✅ Transcript fits within limits. Using single-pass summarization.
```

**特点**：
- 1 次 API 调用
- 10-30 秒完成
- 直接显示结果

### 场景 B：分段模式（完整）

**条件**：字幕 tokens > 可用空间的 50%

**日志**：
```
[Glarity] ⚠️ Transcript too long. Using chunked summarization (3 parts)
[Glarity] Splitting transcript: 20,000 tokens into ~8000 token chunks
[Glarity] Using chunked summarization with 3 parts
[Glarity] Processing chunk 1/3
```

**UI 显示**：
```
┌─────────────────────────────────────┐
│ 🔄 Processing long video...         │
│ ████████████░░░░░░░░░  60%          │
│ Summarizing part 2 of 3...          │
└─────────────────────────────────────┘
```

**特点**：
- 3-10 次 API 调用
- 40-300 秒完成
- 实时进度显示

## 🎯 对于您的 10 分钟视频

**预期**：

| 模型 | 可用空间 | 50% 阈值 | 10分钟视频 | 模式 |
|------|---------|---------|-----------|-----|
| GPT-4o | 119K | 59.5K | ~2K | 单段 ✅ |
| GPT-3.5-turbo | 6K | 3K | ~2K | 单段 ✅ |

但是！如果您的 prompt 特别长，或者视频字幕特别密集，可能会触发分段模式。

## 🔍 故障排查

### 问题 1：仍然只总结 4-5 分钟

**诊断步骤**：

1. **查看控制台的 "Total tokens"**
   - 如果显示 ~2000 tokens（正常）
   - 但仍被截断：说明实际可用空间计算有误

2. **查看 "Available tokens"**
   - GPT-4o 应该显示 ~119,000
   - 如果很小：说明预留值太大

3. **手动查看字幕**
   - 在 Glarity 面板中展开 "Transcript" 部分
   - 复制全部字幕到文本编辑器
   - 检查是否真的获取了完整 10 分钟的字幕

### 问题 2：触发了分段模式但不想要

如果您的视频本来可以单段处理，但触发了分段，可以调整阈值：

**在 `src/content-script/prompt.ts` 第 ~130 行：**
```typescript
// 从 50% 改为 70%
const shouldChunk = totalTokens > availableTokens * 0.7
```

### 问题 3：分段模式很慢

这是正常的！分段模式需要多次 API 调用：
- 3 个 chunks：约 40-120 秒
- 5 个 chunks：约 60-200 秒

如果觉得太慢，可以：
1. 使用更大上下文的模型（Gemini 2.5 Pro）
2. 增加 chunk 大小（在代码中修改）

## 📝 提供反馈

测试后，请告诉我：

1. ✅ 是否使用了哪种模式？（查看控制台日志）
2. ✅ 最终总结覆盖了多长时间？
3. ✅ 时间戳是否准确？
4. ✅ 如果使用了分段模式：
   - 进度条是否显示正常？
   - 耗时多久？
   - 是否能查看分段摘要？

## 🛠️ 临时调试：强制使用分段模式

如果想测试分段功能是否正常工作，可以强制触发：

**在 `src/content-script/prompt.ts` 第 ~130 行：**
```typescript
// 改为 5% 强制分段（测试用）
const shouldChunk = totalTokens > availableTokens * 0.05
```

重新构建：
```bash
npm run build
```

重新加载扩展，任何视频都会使用分段模式。

测试完成后记得改回 `0.5`。

## 📚 完整文档

- [分段总结实现详情](./CHUNKED_SUMMARY_IMPLEMENTATION.md)
- [改进总结](./IMPROVEMENTS_SUMMARY.md)
- [Token 预算测试](./test-token-budget.md)

---

**准备就绪！现在可以测试了 🚀**
