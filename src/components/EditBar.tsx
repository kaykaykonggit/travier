export function EditBar({
  editing,
  onEdit,
  onSave,
  onCancel,
}: {
  editing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  if (!editing) {
    return (
      <button type="button" className="text-btn" onClick={onEdit}>
        修改
      </button>
    );
  }
  return (
    <div className="edit-bar">
      <button type="button" className="text-btn" onClick={onSave}>
        儲存
      </button>
      <button type="button" className="text-btn" onClick={onCancel}>
        取消
      </button>
    </div>
  );
}
