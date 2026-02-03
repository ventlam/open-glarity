# 视频总结截断问题诊断

## 问题现象

**测试视频**: https://www.youtube.com/watch?v=k2ZGNShVWeU
- **实际时长**: 8 分 30 秒
- **总结覆盖**: 6 分 30 秒（最后时间戳：000531-000630）
- **缺失内容**: 最后 2 分钟

## 可能的原因

### 1. 字幕获取不完整
YouTube API 可能没有返回完整的 8.5 分钟字幕。

**验证方法**：
1. 打开视频页面
2. 展开 "Transcript" 面板
3. 滚动到最底部，查看最后一条字幕的时间戳
4. 如果最后一条字幕确实只到 6:30，说明是 YouTube API 问题

### 2. Token 预算过于保守
当前设置：
- Prompt 预留：3000 tokens
- Output 预留：6000 tokens
- 总预留：9000 tokens

如果用户的 prompt 实际只有 1500 tokens，output 实际只需要 4000 tokens，那就浪费了 3500 tokens 的空间。

### 3. 分段阈值设置过高
之前设置：字幕超过可用空间的 50% 才触发分段
现在改为：字幕超过可用空间的 **30%** 就触发分段

## 已实施的改进

### 改进 1：降低分段阈值（刚刚完成）

```typescript
// 从 50% 降低到 30%
const shouldChunk = totalTokens > availableTokens * 0.3
```

**效果**：
- GPT-4o 可用空间：119,000 tokens
- 30% 阈值：35,700 tokens
- 8.5 分钟视频（~1700 tokens）：**仍然不会触发分段**

这说明问题不在分段阈值！

### 改进 2：查看实际 Token 使用情况

**请打开浏览器控制台（F12），查看日志**：

应该看到类似这样的输出：
```
[Glarity] Transcript Analysis:
    Total tokens: 1,700 (字幕实际 token 数)
    Available tokens: 119,000
    Usage: 1%
[Glarity] ✅ Transcript fits within limits. Using single-pass summarization.
```

或者：
```
[Glarity] Token Budget - Model: gpt-4o
    Total Context: 128,000 tokens
    - Prompt Template: ~3,000 tokens
    - Output Reserve: ~6,000 tokens
    = Available for Transcript: 119,000 tokens
    Current Transcript: 1,700 tokens (1%)
[Glarity] ✅ Full transcript fits within context window
```

## 诊断步骤

### 步骤 1：检查字幕完整性

1. 打开视频：https://www.youtube.com/watch?v=k2ZGNShVWeU
2. 重新加载扩展：`chrome://extensions/` → 刷新 Glarity
3. 展开 "Transcript" 面板
4. 查看最后一条字幕的时间戳

**如果最后一条字幕确实只到 6:30**：
→ 这是 YouTube API 问题，不是我们的代码问题
→ 可能原因：
  - 视频的自动生成字幕尚未完成
  - 需要等待或手动刷新

### 步骤 2：检查控制台日志

1. 打开开发者工具（F12）
2. 切换到 Console 标签
3. 生成新的摘要
4. 查找 `[Glarity]` 开头的日志

**关键信息**：
- `Total tokens`: 应该是 ~1700（8.5分钟）
- `Available tokens`: 应该是 ~119,000
- `Usage`: 应该是 ~1%

**如果 Total tokens 只有 1000-1200**：
→ 说明字幕只获取了 6 分钟左右
→ 需要检查 YouTube 字幕 API

### 步骤 3：查看实际输出的 token 预留

如果日志显示：
```
Output Reserve: ~6,000 tokens
```

但实际输出只用了 ~3000 tokens，说明预留太多。

## 临时解决方案

### 方案 A：强制使用分段模式（测试用）

修改 `src/content-script/prompt.ts` 第 ~133 行：

```typescript
// 改为 5% 强制触发分段（测试用）
const shouldChunk = totalTokens > availableTokens * 0.05
```

这样任何视频都会使用分段模式，确保完整覆盖。

**缺点**：
- 每个视频都需要多次 API 调用
- 处理时间变长（1-2 分钟）

### 方案 B：减少预留值（如果 prompt 不复杂）

如果用户的 prompt 实际比较简单，可以减少预留：

修改 `src/content-script/prompt.ts` 第 ~36 行：

```typescript
// 从 3000/6000 改为 2000/4000
const promptEstimate = estimatedPromptTokens ?? 2000
const outputEstimate = estimatedOutputTokens ?? 4000
```

**效果**：
- 增加 3000 tokens 可用空间
- 对于简单 prompt 更高效

### 方案 C：动态计算 Prompt Token 数（最佳方案）

不使用固定预留值，而是实际计算：

```typescript
// 计算实际的 prompt tokens
const promptTokens = tokenizer.encode(fullPromptText).bpe.length
```

这样可以精确预留空间，不浪费。

## 下一步

**请提供以下信息以便诊断**：

1. ✅ Transcript 面板中最后一条字幕的时间戳是多少？
2. ✅ 浏览器控制台中 `[Glarity]` 日志显示的 `Total tokens` 是多少？
3. ✅ 是否看到 "Using single-pass summarization" 还是 "Using chunked summarization"？
4. ✅ 用户的自定义 prompt 有多复杂？（是否包含大量示例文本）

根据这些信息，我可以：
- 如果是字幕问题：无法解决（YouTube API 限制）
- 如果是 token 预算问题：精确调整预留值
- 如果是分段触发问题：调整阈值或强制分段

## 快速测试命令

**方案 A - 强制分段模式**：
```bash
# 修改 prompt.ts 第 133 行
const shouldChunk = totalTokens > availableTokens * 0.05

# 重新构建
npm run build
```

**方案 B - 减少预留**：
```bash
# 修改 prompt.ts 第 36-37 行
const promptEstimate = estimatedPromptTokens ?? 2000
const outputEstimate = estimatedOutputTokens ?? 4000

# 重新构建
npm run build
```

---

**当前状态**：
- ✅ 已降低分段阈值到 30%
- ✅ 已构建新版本
- ⏳ 等待用户提供诊断信息

请重新加载扩展并测试，同时查看控制台日志！
