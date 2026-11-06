export interface TileCoord {
  row: number;
  col: number;
}

/**
 * Calculates next tile index in a grid given arrow key navigation.
 */
export function getNextTileIndex(
  currentIndex: number,
  totalTiles: number,
  columns: number,
  direction: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End'
): number {
  if (totalTiles <= 0) return -1;
  if (currentIndex < 0 || currentIndex >= totalTiles) return 0;

  const cols = Math.max(1, columns);
  const currentRow = Math.floor(currentIndex / cols);
  const currentCol = currentIndex % cols;

  switch (direction) {
    case 'ArrowLeft':
      return Math.max(0, currentIndex - 1);
    case 'ArrowRight':
      return Math.min(totalTiles - 1, currentIndex + 1);
    case 'ArrowUp': {
      const nextIndex = (currentRow - 1) * cols + currentCol;
      return nextIndex >= 0 ? nextIndex : currentIndex;
    }
    case 'ArrowDown': {
      const nextIndex = (currentRow + 1) * cols + currentCol;
      return nextIndex < totalTiles ? nextIndex : currentIndex;
    }
    case 'Home':
      return 0;
    case 'End':
      return totalTiles - 1;
    default:
      return currentIndex;
  }
}

/**
 * Determines the number of columns based on viewport width matching Spec 1:
 * <480px: 2 columns
 * 480px..899px: 3 columns
 * >=900px: 5 columns
 */
export function getColumnCountForWidth(width: number): number {
  if (width < 480) return 2;
  if (width < 900) return 3;
  return 5;
}
