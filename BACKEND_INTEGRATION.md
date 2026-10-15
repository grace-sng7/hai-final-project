# Show Your Work：后端接入说明

> **真实后端接入已就绪**：网络调用在 `lib/http-services.ts`，格式转换在 `lib/backend-wire.ts`，给队友的接口约定见 `BACKEND_CONTRACT.md`，可运行的 Python 起步项目见 `backend_reference/`。设置 `NEXT_PUBLIC_BACKEND_MODE=live` 即可切换（见 `env.example`）。下文描述的前端内部契约仍然有效。

目前运行的是模拟服务，不是已接通的 Python 后端。页面、编辑、模式切换、参数同步、加载失效和重试是真实前端功能；提取能力和计算结论仍来自 mock。

## 1. 两份独立契约

### Extraction：Grace 当前的响应格式

依据 `reference/show_your_work_extraction.ipynb` 的系统提示、`call_llm(user_message)`、更正提示和实际打印结果：

```ts
interface ExtractionResponse {
  assumptions: {
    variable: string;
    value: number | string | null;
    unit: string | null;
    source: 'stated' | 'inferred' | 'missing';
    source_detail: string;
    [key: string]: unknown;
  }[];
  clarification_questions: {
    target_variable: string;
    question: string;
    why_it_matters: string;
    [key: string]: unknown;
  }[];
  goal_summary: string;
  confidence_note: string;
  [key: string]: unknown;
}
```

数组长度、顺序和变量名称不固定。实际输出包含字符串、日期和 `unit: null`；前端不把它们强行转换为数字。不认识的附加字段原样保留。未知 source 值或缺少必需字段会被拒绝，不会伪装为成功。

Notebook 尚未提供 HTTP 路由或正式 request envelope。以下请求结构是**前端建议，需要 Grace 确认**；日期和时区也不是 notebook 已实现的参数：

```json
{
  "user_message": "Please compare my commute options.",
  "reference_date": "2026-10-15",
  "timezone": "America/New_York"
}
```

合法的 extraction 示例：

```json
{
  "assumptions": [
    {"variable":"preferred_route","value":"Train","unit":null,"source":"stated","source_detail":"User preference"},
    {"variable":"travel_days","value":null,"unit":"days","source":"missing","source_detail":"Not supplied"}
  ],
  "clarification_questions": [
    {"target_variable":"travel_days","question":"How many travel days?","why_it_matters":"Needed for the comparison"}
  ],
  "goal_summary":"Compare commute options",
  "confidence_note":"Contract example only"
}
```

更正通过 `ExtractionService.correct` 提交：原始问题、`previous_extraction` 和 `user_correction` 文本，再返回相同的 ExtractionResponse。当前 notebook 的更正例子也是组合文本后重新调用模型；服务端如何包装、鉴权和处理日期仍需确认。

## 2. Calculation：暂定接口，尚未由计算队友确认

完整 TypeScript 定义和运行时校验见 `lib/calculation-contract.ts`。以下是前端需要的适配契约，不是已经存在的 Python API。

输入示例：

```json
{
  "originalQuestion": "Please compare my commute options.",
  "extraction": {
    "assumptions": [
      {"variable":"preferred_route","value":"Train","unit":null,"source":"stated","source_detail":"User preference"},
      {"variable":"travel_days","value":null,"unit":"days","source":"missing","source_detail":"Not supplied"}
    ],
    "clarification_questions": [
      {"target_variable":"travel_days","question":"How many travel days?","why_it_matters":"Needed for the comparison"}
    ],
    "goal_summary":"Compare commute options",
    "confidence_note":"Contract example only"
  },
  "edits": {"1": 21},
  "answers": {},
  "parameters": {"flex": "4"},
  "answerFactBindings": {"days": 1}
}
```

- `edits`：原 extraction 数组索引 → 用户修改，支持 number/string/null。
- `answers`：稳定的澄清键 → 用户回答。回答不一定等于同名事实，例如“愿意动用多少储蓄”不能覆盖“储蓄总额”。
- `answerFactBindings`：仅由服务明确声明的、回答真正更正哪个事实的映射。最新事实编辑会清除旧的关联回答；新回答会替换旧编辑，防止发送互相矛盾的值。
- `parameters`：服务声明的计算参数 → 用户选择；它们不作为提取事实发送给 Grace。
- 所有索引只对这份 extraction 有效。更正后替换 extraction、清空旧映射；后端如采用稳定 ID，需要在 adapter 中转换。

输出示例（静态接口测试，**没有执行真实通勤计算**）：

```json
{
  "status":"ready",
  "answer":{"headline":"Mock comparison supplied by the service."},
  "information":[],
  "questions":[],
  "assumptions":[],
  "parameters":[
    {"id":"flex","label":"Flexible days","value":4,"unit":"days","binding":{"kind":"parameter","key":"flex"},"control":{"type":"range","min":0,"max":10,"step":1}}
  ],
  "metrics":[],
  "explanations":[{"label":"Mock explanation","text":"No real transport costs were calculated."}],
  "limitations":["Contract fixture only."],
  "nextActions":[]
}
```

所有数组都必须存在，可以为空或任意长度。原 extraction 的信息和未覆盖的澄清问题仍由通用展示适配器补充，不会因计算服务不支持而丢失。

支持的状态：

- `ready`：计算完成，必须有非空 `answer.headline`。
- `conditional`：有条件结果，必须有 answer，并可提供假设、参数和解释。
- `needs_input`：只有 message 和所需 questions，不提供 answer。
- `unsupported`：只有 message、可审阅信息和可选下一步，不编造结论。
- `stale`：目前不能使用结果，只有 message；不是有效答案。

请求失败和未知状态不是成功状态：前端保留用户修改，清除可见旧结论，提供 Retry。未知附加字段可保留；未知状态必须拒绝，不能默认视为 ready。

字段采用 `binding` 指定同一个数据来源：`{kind:'fact',index}`、`{kind:'answer',key}` 或 `{kind:'parameter',key}`。数字/日期/选择框只能来自明确 control 元数据；原始澄清问题安全回退为文字输入，不用关键词猜类型。

`questions[].correctsFactIndex` 明确回答与事实的关系；`extractionQuestionIndices` 明确覆盖哪些原始问题。仅 target_variable 相同不足以合并。重复参数 ID 必须具有相同 binding/control/value/unit；inline answer 和 What If 使用同一参数注册表。可选 `answer.segments` 引用 parameterId，页面不会解析财务文字或猜测结论。

仍需计算队友确认：真正输入输出结构、支持哪些模型、必需值与约束、单位和币种、精度、稳定 ID、假设和用户选择的区别、派生值依赖、错误格式，以及由谁把实际结果转换为此暂定契约。

## 3. 当前文件边界和替换位置

- `lib/extraction.ts`：提取契约、校验、`TransportExtractionService`。不导入 fixture，不匹配问题原文。
- `lib/calculation-contract.ts`：暂定计算契约及校验。
- `lib/calculation-service.ts`：`TransportCalculationService`，接收约定的 transport 函数，不假定 URL。
- `lib/services.ts`：唯一默认服务组合点。接入时把两项 mock binding 替换为 transport adapter；设置 `demoMode={false}` 隐藏示例入口。无需更改展示组件。
- `lib/mock/data.ts`：三个示例的提示和测试 extraction 数据。示例按钮只把提示填入输入框，点击 Continue 才请求服务。
- `lib/mock/extraction-service.ts`：mock 内的原文匹配和单个预设更正；不解析任意自然语言。可注入额外 fixture 测试不同主题。
- `lib/mock/calculation-service.ts`：mock 响应提供者。可注入 ready/conditional/needs_input/unsupported 响应或抛错，不改变页面结构。
- `lib/mock/local-demo-calculation.ts` + `lib/calculator.ts`：独立储蓄 demo 实现，只用于明确注册的 mock 数据，仍保留原文上下文、完整快照、单位和参数安全限制。默认仅旅行/电脑示例可用；搬家不支持。真实后端输出不得回退至此公式。
- `lib/calculation-runner.ts`：通用请求快照、校验、错误转为可重试状态、取消过期返回；页面 effect 直接复用这套已测试逻辑。
- `lib/workspace-model.ts`：两种模式共用的原始 extraction、修改、回答、参数、确认和结果版本。
- `lib/presentation-model.ts`、`components/result-view.tsx`：仅根据状态、字段、问题、参数和结果渲染，不根据示例名称或金额选择页面。

建议真实服务的组合方式（不是已实现的端点）：

```ts
const extractionService = new TransportExtractionService({
  extract: agreedExtractionTransport,
  correct: agreedCorrectionTransport,
});
const calculationService = new TransportCalculationService(agreedCalculationTransport);
```

transport 必须由团队根据真实路由、鉴权、超时和错误协议实现。不要把 API 密钥写进客户端代码；Notebook 的模型调用应留在服务器端。

## 4. 状态、失效与模拟范围

原 extraction 保持不变。保存事实、回答问题、调整参数后创建新的计算请求；未完成的编辑或更正草稿会隐藏旧结论。版本号和请求取消保证旧响应不能覆盖新状态。重试走相同接口，模式切换只影响展示。

Submit corrections 向提取服务发送当前有效更正文字；What If 参数不混入事实。更正失败保留草稿，成功接受新 ExtractionResponse。mock 提取目前只有预设更正会成功，其他更正会明确报模拟限制；这不是自然语言提取能力。

原始 inferred 数值在修改后保守标为需要复核，直至获得新 extraction；计算响应中的当前指标独立展示。要自动刷新原派生字段，需要与后端约定依赖及权威更新元数据，不能让 React 猜公式。

当前没有真实 HTTP 连接、持久化或真实计算能力承诺。刷新页面会丢失当前会话。新主题 fixture 仅证明相同前端流程可展示，并不说明后端已支持该主题。

## 5. 验证

`npm test` 包含三个实际示例、Notebook 打印 JSON 兼容性、金额变化、字段/问题数量变化与顺序变化、新的通勤主题、有效修改传递、参数请求、null、未知字段、未知状态、请求失败/重试、同步错误和过期响应取消。原有 800 种动态响应渲染组合及 P0 回归测试继续保留。

同一组测试直接使用 Workspace 的 reducer、请求生命周期和 Quick/Guide 展示组件。架构检查确保正式契约与展示层不引入 fixture 或示例匹配规则。

验证命令：

```sh
npm test
npx eslint app components lib tests/contracts.mjs tests/integration-flow.mjs
npm run build
```

`.agents/` 保持未跟踪且不修改；全仓库 lint 会包含其中已有的独立脚本问题，因此这里使用应用范围 lint。
