export function gradeColor(grade: string): string {
  if (grade === 'A+' || grade === 'A' || grade === 'A-') return '#4CAF50';
  if (grade === 'B+' || grade === 'B' || grade === 'B-') return '#2196F3';
  if (grade === 'C+' || grade === 'C' || grade === 'C-') return '#FF9800';
  if (grade === 'D') return '#F44336';
  return '#B71C1C'; // F
}
