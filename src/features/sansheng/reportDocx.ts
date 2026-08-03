import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import type { ReportMeta, SanshengReport } from './report'

const colors = {
  primary: '0B6B5E',
  accent: '16A394',
  pale: 'EAF7F4',
  border: 'B9D8D2',
  text: '243735',
  muted: '5F7470',
  warning: 'A35B22',
  white: 'FFFFFF',
}

const cellBorders = {
  top: { style: BorderStyle.SINGLE, size: 4, color: colors.border },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: colors.border },
  left: { style: BorderStyle.SINGLE, size: 4, color: colors.border },
  right: { style: BorderStyle.SINGLE, size: 4, color: colors.border },
}

function textParagraph(text: string, options: { bold?: boolean; color?: string; after?: number } = {}) {
  return new Paragraph({
    spacing: { after: options.after ?? 120, line: 360 },
    children: [
      new TextRun({
        text,
        bold: options.bold,
        color: options.color ?? colors.text,
        font: 'Microsoft YaHei',
        size: 21,
      }),
    ],
  })
}

function heading(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    keepNext: true,
    spacing: { before: 260, after: 140 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: colors.accent, space: 4 } },
    children: [new TextRun({ text, bold: true, color: colors.primary, font: 'Microsoft YaHei', size: 28 })],
  })
}

function bullet(text: string) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 70, line: 320 },
    children: [new TextRun({ text, color: colors.text, font: 'Microsoft YaHei', size: 20 })],
  })
}

function makeCell(children: Paragraph[], options: { fill?: string; width?: number; columnSpan?: number } = {}) {
  return new TableCell({
    children,
    columnSpan: options.columnSpan,
    width: options.width ? { size: options.width, type: WidthType.PERCENTAGE } : undefined,
    margins: { top: 120, bottom: 120, left: 140, right: 140 },
    borders: cellBorders,
    shading: options.fill ? { fill: options.fill, type: ShadingType.CLEAR, color: 'auto' } : undefined,
  })
}

function recommendationDetailRow(label: string, value: string) {
  return new TableRow({
    cantSplit: true,
    children: [
      makeCell(
        [
          new Paragraph({
            spacing: { after: 0, line: 320 },
            children: [
              new TextRun({ text: `${label}：`, bold: true, color: colors.primary, font: 'Microsoft YaHei', size: 20 }),
              new TextRun({ text: value, color: colors.text, font: 'Microsoft YaHei', size: 20 }),
            ],
          }),
        ],
        { columnSpan: 2 },
      ),
    ],
  })
}

function metadataTable(meta: ReportMeta) {
  const generatedAt = new Date(meta.generatedAt).toLocaleString('zh-CN', { hour12: false })
  const tokenText = meta.usage ? `${meta.usage.totalTokens} Token` : '未提供'
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          makeCell([textParagraph('生成模型', { bold: true, color: colors.primary, after: 0 })], { fill: colors.pale, width: 18 }),
          makeCell([textParagraph(meta.model, { after: 0 })], { width: 32 }),
          makeCell([textParagraph('生成时间', { bold: true, color: colors.primary, after: 0 })], { fill: colors.pale, width: 18 }),
          makeCell([textParagraph(generatedAt, { after: 0 })], { width: 32 }),
        ],
      }),
      new TableRow({
        cantSplit: true,
        children: [
          makeCell([textParagraph('模型用量', { bold: true, color: colors.primary, after: 0 })], { fill: colors.pale, width: 18 }),
          makeCell([textParagraph(tokenText, { after: 0 })], { width: 32 }),
          makeCell([textParagraph('报告性质', { bold: true, color: colors.primary, after: 0 })], { fill: colors.pale, width: 18 }),
          makeCell([textParagraph('AI 辅助研判', { after: 0 })], { width: 32 }),
        ],
      }),
    ],
  })
}

function dimensionTable(report: SanshengReport) {
  const headerCell = (text: string, width: number) =>
    makeCell(
      [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text, bold: true, color: colors.white, font: 'Microsoft YaHei', size: 20 })],
        }),
      ],
      { fill: colors.primary, width },
    )

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [headerCell('空间维度', 16), headerCell('得分', 12), headerCell('分析判断', 36), headerCell('指标证据', 36)],
      }),
      ...report.dimensionAnalysis.map(
        (item) =>
          new TableRow({
            cantSplit: true,
            children: [
              makeCell([textParagraph(item.dimension, { bold: true, color: colors.primary, after: 0 })], { width: 16 }),
              makeCell(
                [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: String(item.score), bold: true, color: colors.accent, font: 'Arial', size: 24 })],
                  }),
                ],
                { width: 12 },
              ),
              makeCell([textParagraph(item.assessment, { after: 0 })], { width: 36 }),
              makeCell(item.evidence.map((evidence) => bullet(evidence)), { width: 36 }),
            ],
          }),
      ),
    ],
  })
}

function recommendationBlock(item: SanshengReport['recommendations'][number], index: number) {
  const priorityColor = item.priority === '高' ? 'FDEEE8' : item.priority === '中' ? 'FFF7E4' : colors.pale
  return [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            makeCell(
              [textParagraph(`${index + 1}. ${item.action}`, { bold: true, color: colors.primary, after: 0 })],
              { fill: colors.pale, width: 72 },
            ),
            makeCell(
              [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({ text: `${item.priority}优先级`, bold: true, color: item.priority === '高' ? colors.warning : colors.primary, font: 'Microsoft YaHei', size: 20 }),
                  ],
                }),
              ],
              { fill: priorityColor, width: 28 },
            ),
          ],
        }),
        recommendationDetailRow('数据依据', item.basis),
        recommendationDetailRow('预期成效', item.expectedOutcome),
        recommendationDetailRow('实施时序', item.timeframe),
      ],
    }),
    new Paragraph({ spacing: { after: 120 } }),
  ]
}

export function createReportDocxFileName(townName: string) {
  const safeName = townName.replace(/[\\/:*?"<>|]/g, '').trim() || '三生空间'
  return `${safeName}-三生空间详细报告.docx`
}

export function createReportDocument(report: SanshengReport, meta: ReportMeta) {
  const children = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 480, after: 160 },
      children: [new TextRun({ text: report.title, bold: true, color: colors.primary, font: 'Microsoft YaHei', size: 38 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 420 },
      children: [new TextRun({ text: '兰考县和美乡村数字孪生决策平台', color: colors.muted, font: 'Microsoft YaHei', size: 21 })],
    }),
    metadataTable(meta),
    heading('一、执行摘要'),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [new TableRow({ children: [makeCell([textParagraph(report.executiveSummary, { after: 0 })], { fill: colors.pale })] })],
    }),
    heading('二、总体评价'),
    textParagraph(report.overallAssessment),
    heading('三、分维度分析'),
    dimensionTable(report),
    heading('四、主要优势'),
    ...report.strengths.map((item) => bullet(item)),
    heading('五、关键短板'),
    ...report.weaknesses.map((item) => bullet(item)),
    heading('六、行动建议'),
    ...report.recommendations.flatMap((item, index) => recommendationBlock(item, index)),
    heading('七、风险与限制'),
    ...report.risks.map((item) => bullet(item)),
    heading('八、结论'),
    textParagraph(report.conclusion),
    new Paragraph({
      spacing: { before: 260 },
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: colors.border, space: 8 } },
      children: [
        new TextRun({
          text: '说明：本报告由 AI 基于当前页面指标生成，仅供辅助研判，不替代法定规划、实地调查与专家审查。',
          italics: true,
          color: colors.muted,
          font: 'Microsoft YaHei',
          size: 18,
        }),
      ],
    }),
  ]

  return new Document({
    creator: 'GreenTwin',
    title: report.title,
    subject: '三生空间综合评价与治理行动建议',
    description: '由 GreenTwin 平台调用 DeepSeek 生成的结构化辅助研判报告',
    styles: {
      default: {
        document: {
          run: { font: 'Microsoft YaHei', size: 21, color: colors.text },
          paragraph: { spacing: { line: 360, after: 120 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1080, right: 1080, bottom: 1080, left: 1080, header: 540, footer: 540 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: 'GreenTwin 智能研判报告  |  第 ', color: colors.muted, font: 'Microsoft YaHei', size: 17 }),
                  new TextRun({ children: [PageNumber.CURRENT], color: colors.muted, font: 'Arial', size: 17 }),
                  new TextRun({ text: ' 页', color: colors.muted, font: 'Microsoft YaHei', size: 17 }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  })
}

export async function createReportDocxBlob(report: SanshengReport, meta: ReportMeta) {
  return Packer.toBlob(createReportDocument(report, meta))
}
