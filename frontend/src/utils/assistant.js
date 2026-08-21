// src/utils/assistant.js
// Rule-based Q&A over data already loaded from Supabase. Runs entirely in
// the browser — no server round-trip needed.
import { attachRisk } from './riskEngine';

export function answerQuestion(question, { projects, employees, clients }) {
  const q = (question || '').toLowerCase();
  const withRisk = attachRisk(projects, employees);

  if (q.includes('delay')) {
    const list = withRisk.filter((p) => p.status === 'Delayed');
    return list.length
      ? 'Delayed projects: ' + list.map((p) => `${p.name} (${p.client_name || ''}, ${p.progress}% complete)`).join(', ')
      : 'No projects are currently marked Delayed.';
  }
  if (q.includes('overload')) {
    const list = employees.filter((e) => e.workload === 'Overloaded' || e.weekly_hours > 40);
    return list.length
      ? 'Overloaded employees: ' + list.map((e) => `${e.name} (${e.weekly_hours}h/week)`).join(', ')
      : 'No employees are currently overloaded.';
  }
  if (q.includes('high-risk') || q.includes('high risk')) {
    const list = withRisk.filter((p) => p.risk.level === 'High');
    return list.length
      ? 'High-risk projects: ' + list.map((p) => `${p.name} — ${p.risk.reasons[0]}`).join('; ')
      : 'No projects are currently classified as High Risk.';
  }
  if (q.includes('client') && (q.includes('active') || q.includes('most') || q.includes('highest'))) {
    const top = [...clients].sort((a, b) => b.active_projects - a.active_projects)[0];
    return top ? `${top.name} currently has the most active projects (${top.active_projects}).` : 'No client data available.';
  }
  if (q.includes('productiv')) {
    const top = [...employees].sort((a, b) => b.productivity_score - a.productivity_score)[0];
    return top ? `${top.name} has the highest productivity score at ${top.productivity_score}%.` : 'No employee data available.';
  }
  if (q.includes('total project')) {
    return `There are ${projects.length} total projects in the portfolio.`;
  }
  return 'I can help with questions like delayed projects, overloaded employees, high-risk projects, or top clients by active project count.';
}
