<div align="center">
  <img src="./frontend/public/brand-icon.png" alt="我的职业规划ai导师 / My AI Career Mentor" width="96" />

  # 我的职业规划ai导师 / My AI Career Mentor

  简历分析、职业学习路线、就业市场研究与 AI 模拟面试的一站式网站。<br />
  A career-planning website for resume analysis, learning roadmaps, job-market research, and AI mock interviews.

  [中文](#中文) · [English](#english)
</div>

## 中文

### 项目介绍

本项目将职业规划常用工具整合到一个网站：前端使用 Next.js，后端使用 FastAPI。用户可以从简历分析开始，查看技能差距、生成学习路线、研究就业市场，并进行模拟面试。网站支持中文和英文切换。

本地演示默认可免注册、免登录；调用 AI 功能仍需配置一个可用的模型服务 API Key。就业市场和薪资信息请以页面标注的数据来源及日期为准，不应视为实时招聘承诺。

浏览器通过 HTTP 调用 FastAPI；模拟面试的问题和回答使用 WebSocket 传输。默认本地数据存放在 SQLite 数据库中。开启免登录模式时，所有访问者共用同一个本地演示账号，因此不要把该模式直接暴露到公网，也不要在共享演示环境上传真实敏感简历。

**项目结构速览**

| 路径 | 作用 |
| --- | --- |
| `frontend/` | Next.js 页面、双语界面和交互组件 |
| `backend/app/api/` | 简历、学习路线、市场、面试等 API |
| `backend/app/core/` | 模型配置、业务逻辑及面试流程 |
| `backend/tests/` | 后端自动化测试 |
| `start.bat`、`start-local.ps1` | Windows 本地启动与服务检查 |

### 功能列表

- **综合分析**：结合简历、就业市场、学习路线和职业资料建议。
- **简历分析**：上传 PDF 简历，查看 ATS 匹配、技能差距及改进建议。
- **个性化学习路线**：按目标岗位生成分周计划，查看历史记录并跟踪进度。
- **就业市场研究**：查看岗位趋势、地区信息及可用的薪资参考数据。
- **领英资料优化**：生成标题、个人简介和职业形象建议。
- **AI 模拟面试**：选择岗位、公司、面试类型和经验级别，回答动态问题并查看反馈；支持代码编辑区和面试历史。
- **中英双语**：通过网站的语言切换按钮选择中文或英文。

**推荐体验顺序**

1. 在“简历”页上传不超过 5 MB 的文字版 PDF，完成分析并查看改进建议。纯扫描图片 PDF 可能无法提取文字。
2. 在“综合分析”或“学习路线”页填写目标岗位，生成规划并保存进度。
3. 在“就业市场”页查看目标地区与岗位信息，再结合来源日期判断参考价值。
4. 根据结果完善领英资料，最后到“AI 面试官”练习并查看反馈。技术面试开始前建议先完成简历分析。

### 安装步骤

建议使用 **Python 3.11**、**Node.js 20**、npm 和 Git；这也是项目 CI 使用的主要版本。AI 功能需要所选模型服务商的 API Key。以下命令均从项目根目录执行。

**Windows（PowerShell）**

```powershell
git clone https://github.com/tobyblack429-prog/ai-career-mentor.git
cd ai-career-mentor
py -3.11 -m venv backend\venv
.\backend\venv\Scripts\python.exe -m pip install -r .\backend\requirements.txt
npm ci
Copy-Item .\backend\.env.example .\backend\.env
```

如果未安装 Python 启动器 `py`，可以将 `py -3.11` 换成指向 Python 3.11 的 `python`。

**macOS / Linux**

```bash
git clone https://github.com/tobyblack429-prog/ai-career-mentor.git
cd ai-career-mentor
python3.11 -m venv backend/venv
backend/venv/bin/python -m pip install -r backend/requirements.txt
npm ci
cp backend/.env.example backend/.env
```

然后编辑私有文件 `backend/.env`。例如选择硅基流动时，修改文件中已有的对应配置项：

```dotenv
APP_ENV=development
AUTH_DISABLED=true
LLM_PROVIDER=siliconflow
SILICONFLOW_API_KEY=请填入你自己的密钥
SILICONFLOW_MODEL=XingChenAGI/Xing4.0-29B
DATABASE_URL=sqlite:///./dev.db
```

也可以使用 `.env.example` 中列出的其他模型服务商，但必须配置相应的有效密钥。**不要把 `backend/.env` 或真实 API Key 提交到 GitHub。** `AUTH_DISABLED=true` 仅适合本地演示；公开部署时应启用身份验证，并配置安全的密钥和生产数据库。

**常用配置项**

| 变量 | 本地用途 |
| --- | --- |
| `LLM_PROVIDER` | 选择 AI 服务商；设为 `siliconflow` 时仅使用硅基流动 |
| `SILICONFLOW_API_KEY` / `SILICONFLOW_MODEL` | 硅基流动密钥与模型名称；使用其他服务商时配置其对应变量 |
| `DATABASE_URL` | 本地默认使用 SQLite；相对路径基于后端工作目录 |
| `AUTH_DISABLED` | `true` 启用免登录演示，不适合公开部署 |
| `NEXT_PUBLIC_API_URL` | 前端 API 地址；默认是 `http://localhost:8000`，如需修改可放在 `frontend/.env.local` |

### 启动与使用

在 Windows 上，完成安装和配置后双击项目根目录的 `start.bat`。它会在后台启动并检查前后端，然后打开网站；重复运行会复用已就绪的服务。

在 macOS / Linux 上，分别打开两个终端：

```bash
# 终端 1：在项目根目录运行
cd backend
./venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

```bash
# 终端 2：在项目根目录运行
npm run dev -w frontend
```

打开 [http://localhost:3000/dashboard](http://localhost:3000/dashboard) 使用网站；后端健康检查在 [http://localhost:8000/health](http://localhost:8000/health)。建议先在“简历”页面上传并分析 PDF，再使用学习路线、综合分析和技术模拟面试。可在“面试”页面选择岗位、公司及面试类型并开始练习。

Windows 启动窗口关闭后服务仍在后台运行。需要详细查看接口时，可打开 [http://localhost:8000/docs](http://localhost:8000/docs)。Windows 的自动启动与恢复设置见 [本地启动说明](./本地启动说明.md)。

### 常见问题

- **网页打不开：**先运行 `start.bat`，确认前端 3000 和后端 8000 端口没有被其他程序占用，再访问 `/health`。Windows 启动日志在 `logs/`；手动启动时查看终端输出。
- **AI 功能提示模型不可用：**检查 `backend/.env` 中选择的服务商、模型和 API Key；修改后重启后端。不要把密钥贴到问题截图或日志中。
- **面试等待过久：**确认后端健康检查正常，刷新面试页后重试；若仍失败，记录发生时间并检查后端错误日志。
- **市场数据与预期不符：**展示数据可能存在更新间隔，应核对页面给出的来源和日期，重要薪资决策请再查招聘平台原始职位。

### 测试

```powershell
# Windows：在项目根目录运行
.\backend\venv\Scripts\python.exe -m pytest backend\tests -q
npm run build -w frontend
```

```bash
# macOS / Linux：在项目根目录运行
cd backend
./venv/bin/python -m pytest tests -q
cd ..
npm run build -w frontend
```

旧版长篇说明已保存在 [README_legacy.md](./README_legacy.md)，其中部分内容可能过时。

## English

### Overview

This project brings common career-planning tools into one website. The frontend uses Next.js and the backend uses FastAPI. You can analyze a resume, identify skill gaps, build a learning plan, research the job market, and practice interviews. The interface supports both Chinese and English.

The local demo can run without sign-up or sign-in, but AI features still require a valid model-provider API key. Treat market and salary figures as references, and check the source and date shown by the site rather than assuming they are live job offers.

The browser calls FastAPI over HTTP; mock interviews exchange questions and answers over WebSocket. Local data is stored in SQLite by default. With authentication disabled, every visitor shares the same local demo account. Do not expose that mode to the public internet or upload sensitive real resumes to a shared demo.

**Project layout**

| Path | Purpose |
| --- | --- |
| `frontend/` | Next.js pages, bilingual UI, and interactive components |
| `backend/app/api/` | Resume, roadmap, market, and interview endpoints |
| `backend/app/core/` | Model configuration, business logic, and interview flow |
| `backend/tests/` | Backend automated tests |
| `start.bat`, `start-local.ps1` | Windows local startup and service checks |

### Features

- **Full analysis:** Combine resume, market, roadmap, and professional-profile insights.
- **Resume analysis:** Upload a PDF resume for ATS matching, skill-gap feedback, and improvement suggestions.
- **Personalized roadmap:** Generate a week-by-week plan for a target role, revisit history, and track progress.
- **Job-market research:** Explore role trends, locations, and available salary reference data.
- **LinkedIn optimization:** Draft profile headlines, summaries, and positioning suggestions.
- **AI mock interviews:** Choose a role, company, interview type, and experience level; answer adaptive questions and review feedback. A code editor and interview history are included.
- **Bilingual interface:** Switch between Chinese and English in the site.

**Suggested first-use flow**

1. Upload a text-based PDF of up to 5 MB on the Resume page, analyze it, and review the suggestions. Image-only scans may not yield extractable text.
2. Enter a target role in Full Analysis or Roadmap, create a plan, and track progress.
3. Explore locations and roles in Market, checking the data source and date before relying on a figure.
4. Refine your LinkedIn profile, then practice in AI Interviewer and review the feedback. For technical interviews, analyze a resume first.

### Installation

Use **Python 3.11**, **Node.js 20**, npm, and Git where possible; these are the main versions used by CI. AI features require a key from your chosen model provider. Run the following commands from the repository root.

**Windows (PowerShell)**

```powershell
git clone https://github.com/tobyblack429-prog/ai-career-mentor.git
cd ai-career-mentor
py -3.11 -m venv backend\venv
.\backend\venv\Scripts\python.exe -m pip install -r .\backend\requirements.txt
npm ci
Copy-Item .\backend\.env.example .\backend\.env
```

If the `py` launcher is unavailable, replace `py -3.11` with a `python` command that runs Python 3.11.

**macOS / Linux**

```bash
git clone https://github.com/tobyblack429-prog/ai-career-mentor.git
cd ai-career-mentor
python3.11 -m venv backend/venv
backend/venv/bin/python -m pip install -r backend/requirements.txt
npm ci
cp backend/.env.example backend/.env
```

Edit the private `backend/.env` file. For example, to use SiliconFlow, update its existing entries:

```dotenv
APP_ENV=development
AUTH_DISABLED=true
LLM_PROVIDER=siliconflow
SILICONFLOW_API_KEY=your_own_api_key
SILICONFLOW_MODEL=XingChenAGI/Xing4.0-29B
DATABASE_URL=sqlite:///./dev.db
```

You may use another provider listed in `.env.example`, provided you supply a valid matching key. **Never commit `backend/.env` or a real API key to GitHub.** `AUTH_DISABLED=true` is for local demos only; public deployments need authentication, a secure secret, and a production database.

**Key configuration options**

| Variable | Local purpose |
| --- | --- |
| `LLM_PROVIDER` | Select the AI provider; `siliconflow` mode uses only SiliconFlow |
| `SILICONFLOW_API_KEY` / `SILICONFLOW_MODEL` | SiliconFlow key and model; configure matching variables for other providers |
| `DATABASE_URL` | SQLite by default locally; relative paths use the backend working directory |
| `AUTH_DISABLED` | `true` enables the sign-in-free demo; never use it for a public deployment |
| `NEXT_PUBLIC_API_URL` | Frontend API address, defaulting to `http://localhost:8000`; override in `frontend/.env.local` if needed |

### Running and using the app

On Windows, double-click `start.bat` in the repository root after installation and configuration. It starts and checks both services in the background, then opens the site. Running it again reuses healthy services.

On macOS / Linux, use two terminals:

```bash
# Terminal 1: run from the repository root
cd backend
./venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

```bash
# Terminal 2: run from the repository root
npm run dev -w frontend
```

Open [http://localhost:3000/dashboard](http://localhost:3000/dashboard). The backend health endpoint is [http://localhost:8000/health](http://localhost:8000/health). A useful first step is to upload and analyze a PDF on the Resume page, then explore Roadmap, Full Analysis, and technical mock interviews. On the Interview page, select a role, company, and interview type to begin.

On Windows, the services keep running in the background after the startup window closes. API documentation is available at [http://localhost:8000/docs](http://localhost:8000/docs). Windows auto-start and recovery are covered by the [local startup guide](./本地启动说明.md).

### Troubleshooting

- **Site does not open:** Run `start.bat`, check whether another program occupies ports 3000 or 8000, then check `/health`. On Windows inspect time-matched files in `logs/`; with manual startup, inspect the terminal output.
- **AI provider unavailable:** Verify the selected provider, model, and API key in `backend/.env`, then restart the backend. Do not include a key in screenshots or logs you share.
- **Interview keeps waiting:** Check backend health, refresh the interview page, and retry. If it still fails, note the time and inspect the backend error log.
- **Market figure looks wrong:** Data may have an update delay. Verify its source and date, and check original job postings before making an important salary decision.

### Tests

```powershell
# Windows: run from the repository root
.\backend\venv\Scripts\python.exe -m pytest backend\tests -q
npm run build -w frontend
```

```bash
# macOS / Linux: run from the repository root
cd backend
./venv/bin/python -m pytest tests -q
cd ..
npm run build -w frontend
```

The previous long-form README is preserved as [README_legacy.md](./README_legacy.md); some of its information may be outdated.
