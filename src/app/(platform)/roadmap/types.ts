export type RoadmapItemRow = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  priority: string;
  effort: string | null;
  votes: number;
  targetQuarter: string | null;
  moduleId: string | null;
  moduleName: string | null;
  parentId: string | null;
  ownerId: string;
  ownerName: string;
  childCount: number;
  createdAt: string;
};
