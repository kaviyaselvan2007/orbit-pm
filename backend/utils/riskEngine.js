// utils/riskEngine.js
// Rule-based AI risk classification engine.
// Analyzes progress-vs-schedule pace, remaining time, priority and team
// workload to classify a project as Low / Medium / High risk, with
// explainable, human-readable reasons.

const WORKLOAD_SCORE = { Low: 1, Medium: 2, High: 3, Overloaded: 4 };

function computeRisk(project, teamMembers = [], now = new Date()) {
  const start = new Date(project.start_date);
  const end = new Date(project.end_date);
  const totalDays = Math.max((end - start) / 86400000, 1);
  const elapsed = Math.min(Math.max((now - start) / 86400000, 0), totalDays);
  const expectedProgress = Math.min((elapsed / totalDays) * 100, 100);
  const gap = expectedProgress - project.progress; // positive = behind schedule
  const daysLeft = Math.round((end - now) / 86400000);

  const avgWorkloadScore = teamMembers.length
    ? teamMembers.reduce((sum, m) => sum + (WORKLOAD_SCORE[m.workload] || 2), 0) / teamMembers.length
    : 2;

  let score = 0;
  const reasons = [];

  if (project.status === 'Delayed') {
    score += 35;
    reasons.push('Project status is currently Delayed');
  }
  if (gap > 20) {
    score += 30;
    reasons.push(`Progress is ${Math.round(gap)} pts behind the expected schedule pace`);
  } else if (gap > 8) {
    score += 15;
    reasons.push('Slightly behind expected schedule pace');
  }
  if (daysLeft < 14 && project.progress < 85 && project.status !== 'Completed') {
    score += 25;
    reasons.push(`Only ${Math.max(daysLeft, 0)} days remain with ${project.progress}% complete`);
  }
  if (avgWorkloadScore >= 3.3) {
    score += 20;
    reasons.push('Assigned team is overloaded, raising delivery risk');
  } else if (avgWorkloadScore >= 2.6) {
    score += 8;
    reasons.push('Assigned team has a high workload');
  }
  if (project.priority === 'High') score += 10;
  if (project.status === 'Completed') score = Math.min(score, 10);

  let level = 'Low';
  if (score >= 55) level = 'High';
  else if (score >= 28) level = 'Medium';

  if (!reasons.length) reasons.push('Project is tracking on schedule with balanced team workload');

  return {
    level,
    score: Math.min(Math.round(score), 100),
    reasons,
    daysLeft,
    expectedProgress: Math.round(expectedProgress),
  };
}

module.exports = { computeRisk };
