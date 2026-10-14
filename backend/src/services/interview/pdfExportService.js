/**
 * @file pdfExportService.js
 * @summary PDFKit-based service that builds styled A4 PDF documents for interview reports,
 *          learning roadmaps, and preparation plans, then pipes the document stream directly
 *          to the HTTP response. Page numbers are stamped on all pages via buffered rendering.
 *
 * @functions
 * - formatDisplayDate: Formats a date as "Jan 1, 2025" for human-readable display in PDFs.
 * - candidateNameFor: Derives the candidate display name from firstName/lastName or email.
 * - createDocument: Creates a new PDFKit document configured for A4 with buffered pages.
 * - ensureSpace: Adds a new page if there is not enough vertical space for the next block.
 * - addTitle: Renders the document title, optional subtitle, and a separator line.
 * - addSection: Renders a bold section heading with spacing and page-break guard.
 * - addKeyValue: Renders a bold label followed by an inline value on one line.
 * - addScoreGrid: Renders score metrics as a 3-column grid of rounded-rectangle boxes.
 * - addList: Renders an array of items as a bulleted list with dash prefixes.
 * - addParagraph: Renders a block of paragraph text with line gap spacing.
 * - finalizeDocument: Stamps page numbers on all buffered pages and calls doc.end().
 * - buildInterviewReportPdf: Builds a scorecard PDF from session and report data.
 * - buildLearningRoadmapPdf: Builds a roadmap PDF with 7/14/30-day plans and mentor advice.
 * - buildPreparationHubPdf: Builds a multi-track preparation plan PDF from hub data.
 * - streamPdf: Sets PDF response headers and pipes the PDFKit document to the response.
 * - class PdfExportError: Custom error class with statusCode and code fields.
 */

const PDFDocument = require('pdfkit');

class PdfExportError extends Error {
  constructor(message, statusCode = 500, code = 'PDF_EXPORT_ERROR') {
    super(message);
    this.name = 'PdfExportError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

const formatDateForName = (date = new Date()) => {
  const value = new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}_${month}_${day}`;
};

const formatDisplayDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const candidateNameFor = (user) => {
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return name || user?.emailId || 'Candidate';
};

const createDocument = (title) => {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 48,
    bufferPages: true
  });

  doc.info.Title = title;
  doc.info.Author = 'CodeSangram Interview Copilot';
  return doc;
};

const ensureSpace = (doc, needed = 80) => {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
};

const addTitle = (doc, title, subtitle) => {
  doc
    .font('Helvetica-Bold')
    .fontSize(22)
    .fillColor('#111111')
    .text(title);

  if (subtitle) {
    doc
      .moveDown(0.35)
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#666666')
      .text(subtitle);
  }

  doc
    .moveDown(0.8)
    .strokeColor('#E5E7EB')
    .lineWidth(1)
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .stroke()
    .moveDown(1);
};

const addSection = (doc, title) => {
  ensureSpace(doc, 70);
  doc
    .moveDown(0.5)
    .font('Helvetica-Bold')
    .fontSize(14)
    .fillColor('#111111')
    .text(title)
    .moveDown(0.35);
};

const addKeyValue = (doc, label, value) => {
  ensureSpace(doc, 28);
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor('#374151')
    .text(`${label}: `, { continued: true })
    .font('Helvetica')
    .fillColor('#111111')
    .text(String(value ?? 'N/A'));
};

const addScoreGrid = (doc, scores) => {
  const startX = doc.page.margins.left;
  const boxWidth = 156;
  const boxHeight = 52;
  const gap = 12;

  scores.forEach((score, index) => {
    ensureSpace(doc, boxHeight + 18);
    const column = index % 3;
    const rowBreak = column === 0 && index > 0;
    if (rowBreak) doc.moveDown(0.7);

    const x = startX + column * (boxWidth + gap);
    const y = doc.y;

    doc
      .roundedRect(x, y, boxWidth, boxHeight, 6)
      .fillAndStroke('#F9FAFB', '#E5E7EB');

    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor('#6B7280')
      .text(score.label.toUpperCase(), x + 10, y + 10, { width: boxWidth - 20 });

    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .fillColor('#111111')
      .text(String(score.value ?? 0), x + 10, y + 25, { width: boxWidth - 20 });

    if (column === 2 || index === scores.length - 1) {
      doc.y = y + boxHeight;
    }
  });

  doc.moveDown(1);
};

const addList = (doc, items) => {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];

  if (!safeItems.length) {
    doc.font('Helvetica').fontSize(10).fillColor('#6B7280').text('No items available.');
    return;
  }

  safeItems.forEach((item) => {
    ensureSpace(doc, 34);
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#111111')
      .text(`- ${item}`, {
        indent: 8,
        lineGap: 3
      });
  });
};

const addParagraph = (doc, text) => {
  ensureSpace(doc, 60);
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#111111')
    .text(text || 'No details available.', {
      lineGap: 4
    });
};

const finalizeDocument = (doc) => {
  const pages = doc.bufferedPageRange();

  for (let index = 0; index < pages.count; index += 1) {
    doc.switchToPage(index);
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#9CA3AF')
      .text(
        `Page ${index + 1} of ${pages.count}`,
        doc.page.margins.left,
        doc.page.height - 32,
        {
          align: 'center',
          width: doc.page.width - doc.page.margins.left - doc.page.margins.right
        }
      );
  }

  doc.end();
};

const buildInterviewReportPdf = ({ user, report, session }) => {
  const doc = createDocument('Interview Scorecard');
  addTitle(doc, 'Interview Scorecard', 'Generated by CodeSangram Interview Copilot');

  addSection(doc, 'Candidate Details');
  addKeyValue(doc, 'Candidate Name', candidateNameFor(user));
  addKeyValue(doc, 'Interview Date', formatDisplayDate(report.createdAt || session.createdAt));
  addKeyValue(doc, 'Template Type', session.templateType || 'technical');
  addKeyValue(doc, 'Interview Type', session.interviewType || 'N/A');

  addSection(doc, 'Scores');
  addScoreGrid(doc, [
    { label: 'Overall Score', value: report.overallScore },
    { label: 'Technical Score', value: report.technicalScore },
    { label: 'Communication Score', value: report.communicationScore },
    { label: 'Problem Solving Score', value: report.problemSolvingScore },
    { label: 'Project Discussion Score', value: report.projectDiscussionScore }
  ]);

  addSection(doc, 'Strengths');
  addList(doc, report.strengths);

  addSection(doc, 'Weaknesses');
  addList(doc, report.weaknesses);

  addSection(doc, 'Recommendations');
  addList(doc, report.recommendations);

  addSection(doc, 'Interview Summary');
  addParagraph(doc, report.summary);

  addSection(doc, 'Hire Recommendation');
  addParagraph(doc, report.hireRecommendation);

  return doc;
};

const buildLearningRoadmapPdf = ({ user, roadmap }) => {
  const doc = createDocument('Learning Roadmap');
  addTitle(doc, 'Learning Roadmap', `Prepared for ${candidateNameFor(user)}`);

  addSection(doc, 'Focus Areas');
  addList(doc, roadmap.focusAreas);

  addSection(doc, 'Priority Topics');
  addList(doc, roadmap.priorityTopics);

  addSection(doc, '7-Day Plan');
  addList(doc, roadmap.sevenDayPlan);

  addSection(doc, '14-Day Plan');
  addList(doc, roadmap.fourteenDayPlan);

  addSection(doc, '30-Day Plan');
  addList(doc, roadmap.thirtyDayPlan);

  addSection(doc, 'Mentor Advice');
  addParagraph(doc, roadmap.mentorAdvice);

  return doc;
};

const buildPreparationHubPdf = ({ user, preparationHub }) => {
  const doc = createDocument('Preparation Plan');
  addTitle(doc, 'Preparation Plan', `Prepared for ${candidateNameFor(user)}`);

  (preparationHub.tracks || []).forEach((track, index) => {
    if (index > 0) doc.moveDown(0.6);
    addSection(doc, track.name);
    addKeyValue(doc, 'Priority', track.priority);
    addKeyValue(doc, 'Estimated Days', track.estimatedDays);

    addSection(doc, 'Topics');
    addList(doc, track.topics);

    addSection(doc, 'Practice Tasks');
    addList(doc, track.practiceTasks);

    addSection(doc, 'Expected Outcome');
    addParagraph(doc, track.expectedOutcome);
  });

  return doc;
};

const streamPdf = ({ res, doc, filename }) => {
  try {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);
    finalizeDocument(doc);
  } catch (error) {
    throw new PdfExportError('PDF generation failed', 500, 'PDF_GENERATION_FAILURE');
  }
};

module.exports = {
  PdfExportError,
  formatDateForName,
  buildInterviewReportPdf,
  buildLearningRoadmapPdf,
  buildPreparationHubPdf,
  streamPdf
};
