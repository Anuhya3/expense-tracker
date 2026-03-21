import { GripVertical } from 'lucide-react';

export interface WidgetDef {
  id: string;
  label: string;
}

export const DEFAULT_WIDGET_ORDER: WidgetDef[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'insights', label: 'Insights' },
  { id: 'trend', label: 'Spending Trend' },
  { id: 'category', label: 'By Category' },
  { id: 'budget', label: 'Budget Status' },
  { id: 'activity', label: 'Activity' }
];

interface DashboardWidgetProps {
  id: string;
  children: React.ReactNode;
  onDragStart: (id: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDrop: (e: React.DragEvent, id: string) => void;
  isDragOver: boolean;
}

export default function DashboardWidget({
  id, children, onDragStart, onDragOver, onDrop, isDragOver
}: DashboardWidgetProps) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(id)}
      onDragOver={(e) => { e.preventDefault(); onDragOver(e, id); }}
      onDrop={(e) => onDrop(e, id)}
      className={`group relative transition-all duration-200 ${
        isDragOver ? 'ring-2 ring-gray-400 dark:ring-gray-500 ring-offset-2 rounded-2xl scale-[0.99] opacity-80' : ''
      }`}
    >
      {/* Drag handle — shown on hover */}
      <div className="absolute top-3 left-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
        <GripVertical className="w-4 h-4 text-gray-300 dark:text-gray-600" />
      </div>
      {children}
    </div>
  );
}
