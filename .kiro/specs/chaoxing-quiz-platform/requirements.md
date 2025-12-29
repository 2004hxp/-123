# Requirements Document

## Introduction

本项目旨在开发一个刷题网站，用于从超星学习通/慕课平台的作业详情页面HTML源码中提取题目数据，并提供在线刷题、错题本、进度统计等功能。

## HTML结构分析

### 页面整体结构

```
#fanyaMarking.TiMu - 题目主容器
├── .fanyaMarking_left - 左侧内容区
│   ├── .detailsHead - 作业头部信息
│   │   ├── .mark_title - 作业标题
│   │   └── .infoHead - 题量、满分、作答时间等
│   └── .mark_table - 题目列表区
│       └── .mark_item - 题型分组
│           ├── .type_tit - 题型标题（如"一. 单选题（共174题）"）
│           └── .questionLi.singleQuesId - 单个题目容器
```

### 题目容器结构

```html
<div class="marBom60 questionLi singleQuesId" 
     id="question{题目ID}" 
     data="{题目ID}">
  <div class="aiArea">
    <div class="aiAreaContent">
      <!-- 题目标题 -->
      <h3 class="mark_name colorDeep">
        {序号}. <span class="colorShallow">({题型})</span>
        <span class="qtContent workTextWrap">{题目内容}</span>
      </h3>
      
      <!-- 选项列表（选择题） -->
      <ul class="mark_letter colorDeep qtDetail">
        <li class="workTextWrap">A. {选项A}</li>
        <li class="workTextWrap">B. {选项B}</li>
        ...
      </ul>
      
      <!-- 答案区域 -->
      <div class="mark_answer">
        <div class="mark_key clearfix">
          <span class="colorGreen"><i>正确答案:</i><span class="rightAnswerContent">{正确答案}</span></span>
        </div>
      </div>
    </div>
  </div>
</div>
```

### 题型标识

| 题型 | 标识文本 | 类型代码 |
|------|----------|----------|
| 单选题 | (单选题) | 0 |
| 多选题 | (多选题) | 1 |
| 材料题 | (材料题) | 4 |
| 论述题 | (论述题) | 6 |

### 关键CSS选择器

- `.TiMu` / `#fanyaMarking` - 题目主容器
- `.questionLi.singleQuesId` - 单个题目
- `.mark_name` - 题目标题
- `.qtContent` - 题目内容
- `.mark_letter.qtDetail` - 选项列表
- `.rightAnswerContent` - 正确答案
- `.type_tit` - 题型标题
- `.piyu` - 教师批语（主观题）

## Glossary

- **Quiz_Platform**: 刷题网站系统
- **Question_Parser**: 题目解析器，负责从HTML提取题目数据
- **Question_Bank**: 题库，存储所有题目数据
- **Practice_Session**: 练习会话，用户的一次刷题过程
- **Wrong_Book**: 错题本，记录用户答错的题目
- **Progress_Tracker**: 进度追踪器，统计用户学习进度

## Requirements

### Requirement 1: HTML解析与数据提取

**User Story:** As a 用户, I want to 从超星学习通HTML源码中提取题目数据, so that 我可以将题目导入到刷题系统中。

#### Acceptance Criteria

1. WHEN 用户上传HTML文件 THEN THE Question_Parser SHALL 解析文件并提取所有题目数据
2. WHEN 解析HTML时 THE Question_Parser SHALL 识别题目ID、序号、题型、题目内容、选项、正确答案
3. WHEN 解析选择题时 THE Question_Parser SHALL 提取所有选项（A、B、C、D等）及其内容
4. WHEN 解析主观题时 THE Question_Parser SHALL 提取题目内容和参考答案
5. IF 解析过程中遇到格式错误 THEN THE Question_Parser SHALL 记录错误并继续解析其他题目
6. FOR ALL 解析后的题目数据 THE Question_Parser SHALL 输出为JSON格式以便存储

### Requirement 2: 题库管理

**User Story:** As a 管理员, I want to 管理题库中的题目, so that 我可以维护和更新题目内容。

#### Acceptance Criteria

1. THE Question_Bank SHALL 支持按题型分类存储题目（单选、多选、材料题、论述题）
2. WHEN 导入新题目时 THE Question_Bank SHALL 检测重复题目并提示用户
3. THE Question_Bank SHALL 支持按关键词搜索题目
4. THE Question_Bank SHALL 支持按题型筛选题目
5. WHEN 删除题目时 THE Question_Bank SHALL 同步更新相关的错题记录和练习记录

### Requirement 3: 刷题练习

**User Story:** As a 学生, I want to 在线练习题目, so that 我可以巩固所学知识。

#### Acceptance Criteria

1. WHEN 用户开始练习 THE Practice_Session SHALL 按用户选择的模式（顺序/随机/错题）加载题目
2. WHEN 用户提交答案 THE Quiz_Platform SHALL 立即显示答案正误和正确答案
3. WHEN 用户答错题目 THE Quiz_Platform SHALL 自动将该题加入错题本
4. THE Quiz_Platform SHALL 支持单题模式和批量模式两种练习方式
5. WHEN 练习结束 THE Quiz_Platform SHALL 显示本次练习的正确率和用时统计

### Requirement 4: 错题本功能

**User Story:** As a 学生, I want to 查看和复习我的错题, so that 我可以针对性地加强薄弱环节。

#### Acceptance Criteria

1. THE Wrong_Book SHALL 记录用户每次答错的题目及答错时间
2. THE Wrong_Book SHALL 支持按题型、时间筛选错题
3. WHEN 用户在错题本中答对某题 THE Wrong_Book SHALL 标记该题为已掌握
4. THE Wrong_Book SHALL 显示每道错题的错误次数统计
5. THE Wrong_Book SHALL 支持导出错题为PDF或打印

### Requirement 5: 学习进度统计

**User Story:** As a 学生, I want to 查看我的学习进度和统计数据, so that 我可以了解自己的学习情况。

#### Acceptance Criteria

1. THE Progress_Tracker SHALL 记录用户每日练习题数和正确率
2. THE Progress_Tracker SHALL 显示各题型的掌握程度（已做/总数、正确率）
3. THE Progress_Tracker SHALL 生成学习趋势图表（按日/周/月）
4. THE Progress_Tracker SHALL 显示连续学习天数和总学习时长

### Requirement 6: 用户界面

**User Story:** As a 用户, I want to 使用简洁美观的界面, so that 我可以专注于学习而不被复杂的操作分心。

#### Acceptance Criteria

1. THE Quiz_Platform SHALL 提供响应式设计，支持PC和移动端访问
2. THE Quiz_Platform SHALL 支持深色/浅色主题切换
3. WHEN 显示题目时 THE Quiz_Platform SHALL 清晰展示题目内容、选项和答案区域
4. THE Quiz_Platform SHALL 提供键盘快捷键支持（如1-4选择选项，Enter提交）
5. WHEN 加载数据时 THE Quiz_Platform SHALL 显示加载状态指示器

### Requirement 7: 数据持久化

**User Story:** As a 用户, I want to 我的学习数据被安全保存, so that 我可以随时继续学习。

#### Acceptance Criteria

1. THE Quiz_Platform SHALL 将用户数据存储在本地存储（localStorage）或后端数据库
2. WHEN 用户关闭浏览器后重新打开 THE Quiz_Platform SHALL 恢复用户的学习进度
3. THE Quiz_Platform SHALL 支持数据导出和导入功能
4. IF 存储空间不足 THEN THE Quiz_Platform SHALL 提示用户并提供清理建议
