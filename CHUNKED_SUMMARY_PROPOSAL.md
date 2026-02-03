# 长视频分段总结功能改进方案

## 问题分析

### 当前限制

在 `src/content-script/prompt.ts` 中：

```typescript
const textLimit = 14000  // 字节限制
const limit = 1100       // Token限制 (非GPT3)
const apiLimit = 2000    // Token限制 (GPT3)
```

**现有行为**：
- 当视频字幕超过 token 限制时，`truncateTranscript()` 函数会直接截断文本
- 只总结前面几分钟的内容，后面的内容被丢弃

**影响**：
- 长视频（>15分钟）无法获得完整总结
- 用户只能看到视频开头部分的摘要
- 对于1小时+的视频，大部分内容被忽略

---

## 解决方案

### 方案 A：分段总结 + 最终合并（推荐）

**流程**：
1. 将长字幕分成多个段落（每段 ~1000 tokens）
2. 对每个段落独立调用 API 获取摘要
3. 将所有段落摘要合并，再调用一次 API 生成最终总结

**优点**：
- 覆盖完整视频内容
- 最终总结质量高（经过二次提炼）
- 分段边界可以按时间/句子智能切分

**缺点**：
- 需要多次 API 调用（成本增加）
- 总耗时更长

---

### 方案 B：滚动窗口总结

**流程**：
1. 将字幕分成重叠的窗口（每窗口 1000 tokens，重叠 200 tokens）
2. 逐窗口总结
3. 合并所有窗口摘要

**优点**：
- 段落连续性好（重叠区域避免信息丢失）
- 适合故事类/连续叙事视频

**缺点**：
- 实现复杂度更高
- 仍需多次 API 调用

---

### 方案 C：层次化总结

**流程**：
1. 将视频分成 N 个章节（按字幕时间戳）
2. 每章节独立总结
3. 将章节摘要递归合并（如果仍超长）

**优点**：
- 保留视频结构（章节边界清晰）
- 适合有明显段落的教程/讲座视频

**缺点**：
- 需要检测章节边界（可能不准确）
- 递归合并增加实现难度

---

## 推荐实现：方案 A（分段总结 + 最终合并）

### 1. 修改 `src/content-script/prompt.ts`

添加新函数处理分段逻辑：

```typescript
/**
 * 将长文本分成多个可处理的段落
 * @param text - 完整字幕文本
 * @param providerConfig - 模型配置
 * @returns 分段数组
 */
export function splitTextIntoChunks(
  text: string,
  providerConfig?: ProviderType
): string[] {
  const tokenLimit = providerConfig === ProviderType.GPT3 ? apiLimit : limit;
  const targetTokens = tokenLimit - 200; // 留出buffer给prompt

  const encoded = tokenizer.encode(text);
  const totalTokens = encoded.bpe.length;

  if (totalTokens <= targetTokens) {
    return [text]; // 无需分段
  }

  // 计算需要分几段
  const numChunks = Math.ceil(totalTokens / targetTokens);
  const chunks: string[] = [];

  // 按句子分段（避免截断句子）
  const sentences = text.split(/[.!?。！？]\s+/);
  let currentChunk = '';
  let currentTokens = 0;

  for (const sentence of sentences) {
    const sentenceTokens = tokenizer.encode(sentence).bpe.length;

    if (currentTokens + sentenceTokens > targetTokens && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
      currentTokens = sentenceTokens;
    } else {
      currentChunk += (currentChunk ? '. ' : '') + sentence;
      currentTokens += sentenceTokens;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * 生成分段总结的 prompt
 * @param chunkText - 当前段落文本
 * @param chunkIndex - 段落索引
 * @param totalChunks - 总段落数
 * @returns Prompt
 */
export function getChunkSummaryPrompt(
  chunkText: string,
  chunkIndex: number,
  totalChunks: number
): string {
  return `This is part ${chunkIndex + 1} of ${totalChunks} from a video transcript. Please summarize this part concisely:

${chunkText}

Provide a summary of the key points in this section.`;
}

/**
 * 生成最终合并总结的 prompt
 * @param chunkSummaries - 所有段落摘要
 * @returns Prompt
 */
export function getFinalSummaryPrompt(chunkSummaries: string[]): string {
  const combined = chunkSummaries
    .map((summary, i) => `Part ${i + 1}:\n${summary}`)
    .join('\n\n');

  return `I have summaries of different parts of a video. Please combine them into a comprehensive final summary:

${combined}

Provide a cohesive summary that captures the main ideas of the entire video.`;
}
```

---

### 2. 修改视频总结调用逻辑

在 `src/content-script/compenents/GetQuestion.tsx` 或相关组件中：

```typescript
async function summarizeLongVideo(transcript: string, providerConfig: ProviderType) {
  // 1. 检查是否需要分段
  const chunks = splitTextIntoChunks(transcript, providerConfig);

  if (chunks.length === 1) {
    // 无需分段，直接总结
    return getSummaryPrompt(transcript, providerConfig);
  }

  // 2. 显示进度提示
  console.log(`Long video detected. Splitting into ${chunks.length} parts...`);

  // 3. 逐段总结（这里需要逐个调用 API）
  const chunkSummaries: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const prompt = getChunkSummaryPrompt(chunks[i], i, chunks.length);

    // 调用 ChatGPT API（需要修改 ChatGPTQuery 组件支持）
    const summary = await callChatGPTAPI(prompt);
    chunkSummaries.push(summary);

    // 更新进度
    console.log(`Summarized part ${i + 1}/${chunks.length}`);
  }

  // 4. 合并所有摘要
  const finalPrompt = getFinalSummaryPrompt(chunkSummaries);
  return finalPrompt;
}
```

---

### 3. UI 改进

#### 添加进度指示器

在 `src/content-script/compenents/ChatGPTQuery.tsx` 中：

```tsx
{isProcessingLongVideo && (
  <div className="glarity--progress">
    <div className="glarity--progress-bar">
      <div
        className="glarity--progress-fill"
        style={{ width: `${progress}%` }}
      />
    </div>
    <p className="glarity--progress-text">
      Processing long video: {currentChunk}/{totalChunks} parts
    </p>
  </div>
)}
```

#### 添加用户设置选项

在 `src/options/components/PageSummary.tsx` 中添加配置：

```tsx
<div className="option-row">
  <label>
    <input
      type="checkbox"
      checked={enableChunkedSummary}
      onChange={(e) => setEnableChunkedSummary(e.target.checked)}
    />
    Enable chunked summary for long videos (may use more API calls)
  </label>
</div>

<div className="option-row">
  <label>
    Max chunks per video:
    <select value={maxChunks} onChange={(e) => setMaxChunks(Number(e.target.value))}>
      <option value="3">3 (up to 45 min)</option>
      <option value="5">5 (up to 75 min)</option>
      <option value="10">10 (up to 2.5 hours)</option>
    </select>
  </label>
</div>
```

---

## 实现优先级

### Phase 1: 核心功能（必须）
- [x] 实现 `splitTextIntoChunks()` 函数
- [x] 实现分段 prompt 生成
- [ ] 修改 API 调用逻辑支持多次调用
- [ ] 添加简单进度提示

### Phase 2: 用户体验（推荐）
- [ ] 添加进度条 UI
- [ ] 添加设置选项（启用/禁用分段）
- [ ] 添加估算 API 成本提示

### Phase 3: 高级优化（可选）
- [ ] 智能章节检测（基于字幕时间戳）
- [ ] 缓存分段摘要（避免重复计算）
- [ ] 支持用户手动调整分段策略

---

## 成本估算

**示例：1小时视频**
- 字幕文本: ~10,000 tokens
- 分成: 10 个段落（每段 1000 tokens）
- API 调用次数: 11 次（10次分段 + 1次合并）

**GPT-3.5-turbo 成本**:
- Input: 10,000 + 2,000 (合并) = 12,000 tokens × $0.0015/1K = $0.018
- Output: ~2,000 tokens × $0.002/1K = $0.004
- **总成本**: ~$0.022 per 1-hour video

**对比**:
- 当前方案（截断）: 只处理前 ~1000 tokens，成本 ~$0.002
- 新方案: 完整处理，成本增加 10x，但内容覆盖 100%

---

## 备选方案（降低成本）

### 选项 1: 自适应采样
只在视频 >30 分钟时启用分段，短视频仍使用截断

### 选项 2: 用户付费选项
- 免费用户: 只总结前 15 分钟
- 付费用户: 完整分段总结

### 选项 3: 混合策略
- 前 1000 tokens: 详细总结
- 后续部分: 提取关键点（bullet points）
- 最后合并：前详 + 后略

---

## 技术风险

1. **API 速率限制**: 短时间多次调用可能触发限流
   - 缓解：添加延迟（每次调用间隔 1-2 秒）

2. **用户等待时间**: 10 段视频可能需要 30-60 秒
   - 缓解：显示进度条 + 允许取消

3. **错误处理**: 某一段失败可能导致整体失败
   - 缓解：重试机制 + 跳过失败段落

---

## 测试计划

### 测试用例

| 视频长度 | 字幕 Tokens | 预期分段数 | 预期耗时 |
|----------|-------------|-----------|---------|
| 5 分钟   | 500         | 1         | 3 秒    |
| 30 分钟  | 3,000       | 3         | 15 秒   |
| 1 小时   | 10,000      | 10        | 60 秒   |
| 2 小时   | 20,000      | 20        | 120 秒  |

### 质量验证

1. **完整性**: 检查最终摘要是否覆盖视频所有主题
2. **连贯性**: 段落摘要合并后是否流畅
3. **准确性**: 关键信息是否遗漏或错误

---

## 总结

**推荐方案**: Phase 1 + Phase 2

**预期收益**:
- ✅ 支持任意长度视频总结
- ✅ 提升用户体验（完整内容覆盖）
- ✅ 成本可控（用户可选）

**实施时间**:
- Phase 1: 1-2 天
- Phase 2: 1 天
- **总计**: 2-3 天

---

## 参考文档

- OpenAI Token 限制: https://platform.openai.com/docs/models/gpt-3-5
- Chunking 最佳实践: https://www.pinecone.io/learn/chunking-strategies/
- LangChain Map-Reduce: https://python.langchain.com/docs/modules/chains/document/map_reduce

---

**版本**: 1.0
**作者**: Claude
**日期**: 2026-02-03
