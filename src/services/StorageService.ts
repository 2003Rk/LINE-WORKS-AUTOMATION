import * as fs from 'fs';
import * as path from 'path';

interface Group {
  groupId: string;
  groupName: string;
  platform: 'line' | 'lineworks';
  driveFolderId: string;
  folderName: string;
  email: string;
  enabled: boolean;
  addedAt: string;
}

export class StorageService {
  private dataFile: string;
  private data!: { groups: Group[] };

  constructor() {
    this.dataFile = path.join(__dirname, '../../data/groups.json');
    this.ensureDataFile();
    this.loadData();
  }

  private ensureDataFile() {
    const dataDir = path.dirname(this.dataFile);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.dataFile)) {
      fs.writeFileSync(this.dataFile, JSON.stringify({ groups: [] }, null, 2));
    }
  }

  private loadData() {
    try {
      const content = fs.readFileSync(this.dataFile, 'utf-8');
      this.data = JSON.parse(content);
    } catch (error) {
      this.data = { groups: [] };
    }
  }

  private saveData() {
    fs.writeFileSync(this.dataFile, JSON.stringify(this.data, null, 2));
  }

  getAllGroups(): Group[] {
    return this.data.groups;
  }

  findGroup(groupId: string): Group | null {
    return this.data.groups.find(g => g.groupId === groupId) || null;
  }

  addGroup(group: Omit<Group, 'addedAt'>): void {
    const existing = this.findGroup(group.groupId);
    if (existing) {
      throw new Error('Group already exists');
    }
    
    this.data.groups.push({
      ...group,
      addedAt: new Date().toISOString()
    });
    this.saveData();
  }

  updateGroup(groupId: string, updates: Partial<Group>): void {
    const index = this.data.groups.findIndex(g => g.groupId === groupId);
    if (index === -1) {
      throw new Error('Group not found');
    }
    
    this.data.groups[index] = { ...this.data.groups[index], ...updates };
    this.saveData();
  }

  deleteGroup(groupId: string): void {
    this.data.groups = this.data.groups.filter(g => g.groupId !== groupId);
    this.saveData();
  }

  toggleEnabled(groupId: string): boolean {
    const group = this.findGroup(groupId);
    if (!group) {
      throw new Error('Group not found');
    }
    
    group.enabled = !group.enabled;
    this.updateGroup(groupId, { enabled: group.enabled });
    return group.enabled;
  }
}
