# Token 预算测试说明

## 修改内容

### 更精确的 Token 预算计算

**旧逻辑**：
```
recommendedInputLimit = maxInputTokens - maxOutputTokens - 1000
```
- GPT-4o: 128K - 16K - 1K = 111K（用于整个 prompt + transcript）

**新逻辑**：
```
availableForTranscript = maxInputTokens - promptTemplate - outputReserve
```
- GPT-4o: 128K - 1K(prompt) - 3K(output) = **124K**（仅用于 transcript）

### 默认预留值

| 项目 | 旧值 | 新值 | 说明 |
|------|-----|------|------|
| Prompt 模板 | ~1000 tokens | **1000 tokens** | Title + Instructions + Language |
| 输出预留 | maxOutputTokens * 0.8 (~13K) | **3000 tokens** | 更合理的估算 |
| 可用于 Transcript | 111K - prompt | **124K** | 大幅增加 |

## 测试场景

### 场景 1：5.5 分钟视频（用户的测试视频）

**视频**: https://www.youtube.com/watch?v=KEVE5LK8jwo

**预期 Token 计算**：
- 视频时长: 5.5 分钟
- 字幕 tokens: ~1,100 tokens（按 200 tokens/分钟）
- 可用空间: 124,000 tokens
- **结果**: ✅ 完整字幕应该能被处理

### 场景 2：用户的复杂 Prompt

如果用户的 prompt 类似这样：
```
请按以下格式输出：
## 核心概要
一句话总结：[总结]

## 关键洞察
- [洞察1]
- [洞察2]
...

## 议题发展脉络
### 时间戳 [HH:MM:SS - HH:MM:SS]
核心议题：[议题]
详细内容提炼：[内容]
```

这个 prompt 本身可能就有 **500-800 tokens**。

### 问题排查

如果用户仍然只看到 3 分钟的总结，可能的原因：

1. **用户的 prompt 非常长**（>1000 tokens）
   - 解决：增加 `estimatedPromptTokens` 参数

2. **模型的实际输出超过了 3000 tokens**
   - 解决：增加 `estimatedOutputTokens` 参数

3. **字幕本身的 token 计算有误**
   - 解决：检查 tokenizer 是否正确工作

## 测试步骤

### 1. 查看控制台日志

打开浏览器开发者工具（F12），在控制台中查看：

```
[Glarity] Token Budget - Model: gpt-4o
    Total Context: 128,000 tokens
    - Prompt Template: ~1,000 tokens
    - Output Reserve: ~3,000 tokens
    = Available for Transcript: 124,000 tokens
    Current Transcript: 1,100 tokens (1%)
[Glarity] ✅ Full transcript fits within context window
```

### 2. 如果仍然被截断

检查日志中的 `Current Transcript` 值：
- 如果远小于预期（例如只有 600 tokens），说明字幕获取有问题
- 如果接近 124K 但仍被截断，说明需要调整预留值

### 3. 调整预留值（如果需要）

如果用户的 prompt 确实很长，可以在调用时传递自定义值：

```typescript
// 在 GetQuestion.tsx 中
const content = getSummaryPrompt(
  articleText,
  providerConfigs.provider,
  modelName,
  2000,  // estimatedPromptTokens（如果 prompt 很长）
  5000   // estimatedOutputTokens（如果要求详细输出）
)
```

## 预期改进

### 对于 5.5 分钟视频

**之前可能的问题**：
- 如果预留了 13K 给输出，只剩 111K 给 prompt+transcript
- 如果 prompt 很长，实际可用空间会更少

**现在**：
- 预留 3K 给输出（更合理）
- 预留 1K 给 prompt
- 剩余 124K 全部用于 transcript
- **5.5 分钟 = 1,100 tokens，完全够用**

### 时间戳准确性

如果之前时间戳错误，是因为：
- 字幕在中间被截断
- 导致后面的时间戳信息丢失

现在应该能保留完整字幕，时间戳也会准确。

## 下一步优化（如果仍有问题）

1. **动态检测 prompt 长度**
   - 在 `getSummaryPrompt()` 中实际计算 prompt 的 token 数
   - 而不是使用估算值

2. **添加用户配置选项**
   - 让用户在设置中指定预留的输出 token 数
   - 适应不同的总结风格（简洁 vs 详细）

3. **实施分段总结**
   - 对于超长视频或极详细的输出需求
   - 使用 Map-Reduce 策略
