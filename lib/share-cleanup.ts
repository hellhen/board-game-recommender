import { promises as fs } from 'fs';
import path from 'path';

const SHARES_DIR = path.join(process.cwd(), 'data', 'shares');
const MAX_FILE_AGE_DAYS = 30; // Files older than 30 days will be deleted
const MAX_TOTAL_FILES = 1000; // Maximum number of share files to keep

/**
 * Clean up old share files
 */
export async function cleanupOldShares(): Promise<number> {
  try {
    const files = await fs.readdir(SHARES_DIR);
    let deletedCount = 0;
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - (MAX_FILE_AGE_DAYS * 24 * 60 * 60 * 1000));
    
    // Get file stats and sort by creation time
    const fileStats = [];
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      
      const filePath = path.join(SHARES_DIR, file);
      const stats = await fs.stat(filePath);
      fileStats.push({ file, path: filePath, mtime: stats.mtime });
    }
    
    // Sort oldest first
    fileStats.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());
    
    // Delete old files
    for (const { file, path: filePath, mtime } of fileStats) {
      if (mtime < cutoffDate) {
        await fs.unlink(filePath);
        deletedCount++;
        console.log(`🧹 Deleted old share file: ${file} (age: ${Math.round((now.getTime() - mtime.getTime()) / (24 * 60 * 60 * 1000))} days)`);
      }
    }
    
    // If still too many files, delete the oldest ones
    const remainingFiles = fileStats.length - deletedCount;
    if (remainingFiles > MAX_TOTAL_FILES) {
      const filesToDelete = remainingFiles - MAX_TOTAL_FILES;
      const remainingFileStats = fileStats.slice(deletedCount);
      
      for (let i = 0; i < filesToDelete; i++) {
        await fs.unlink(remainingFileStats[i].path);
        deletedCount++;
        console.log(`🧹 Deleted excess share file: ${remainingFileStats[i].file}`);
      }
    }
    
    return deletedCount;
  } catch (error) {
    console.error('Error cleaning up share files:', error);
    return 0;
  }
}

/**
 * Get share file age in days
 */
export async function getShareFileAge(shareId: string): Promise<number | null> {
  try {
    const filePath = path.join(SHARES_DIR, `${shareId}.json`);
    const stats = await fs.stat(filePath);
    const ageMs = Date.now() - stats.mtime.getTime();
    return Math.floor(ageMs / (24 * 60 * 60 * 1000));
  } catch {
    return null;
  }
}
