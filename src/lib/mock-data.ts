export type VideoStatus = "processed" | "processing" | "queued";

export interface Video {
  id: string;
  title: string;
  filename: string;
  duration: string;
  durationSeconds: number;
  uploadDate: string;
  status: VideoStatus;
  size: string;
  tags: string[];
  description: string;
  transcript: string;
  color: string;
}

export interface SearchResult {
  id: string;
  video: Video;
  matchedAt: string;
  matchedAtSeconds: number;
  endAt: string;
  relevanceScore: number;
  transcriptSnippet: string;
}

export interface RecentSearch {
  id: string;
  query: string;
  timestamp: string;
  resultsCount: number;
}

export interface UploadFile {
  id: string;
  filename: string;
  size: string;
  progress: number;
  status: "uploading" | "complete" | "error";
}

export const mockVideos: Video[] = [
  {
    id: "1",
    title: "Product Demo – Q4 2024",
    filename: "product_demo_q4.mp4",
    duration: "12:34",
    durationSeconds: 754,
    uploadDate: "Jan 15, 2025",
    status: "processed",
    size: "1.2 GB",
    tags: ["demo", "product", "q4", "presentation"],
    description: "Full product demonstration recording from Q4 2024 all-hands meeting.",
    transcript: "Welcome everyone to our Q4 product demo. Today we'll be walking through the new features we've shipped this quarter, starting with the redesigned dashboard...",
    color: "#6366f1",
  },
  {
    id: "2",
    title: "Team Standup – Jan 20",
    filename: "standup_jan20.mp4",
    duration: "08:12",
    durationSeconds: 492,
    uploadDate: "Jan 20, 2025",
    status: "processed",
    size: "780 MB",
    tags: ["standup", "team", "january"],
    description: "Daily standup recording for January 20th.",
    transcript: "Good morning team. Let's go around and share what everyone is working on today. Alice, do you want to start?",
    color: "#0ea5e9",
  },
  {
    id: "3",
    title: "Customer Interview – Acme Corp",
    filename: "interview_acme.mov",
    duration: "34:07",
    durationSeconds: 2047,
    uploadDate: "Jan 18, 2025",
    status: "processed",
    size: "3.4 GB",
    tags: ["interview", "customer", "acme", "feedback"],
    description: "In-depth customer interview with the Acme Corp product team about their pain points.",
    transcript: "So tell me a bit about how your team currently handles video management. Right, so we have about 200 recordings per month and they just pile up in Google Drive...",
    color: "#f59e0b",
  },
  {
    id: "4",
    title: "Outdoor Event Recap – Austin",
    filename: "outdoor_austin.mp4",
    duration: "22:45",
    durationSeconds: 1365,
    uploadDate: "Jan 22, 2025",
    status: "processed",
    size: "2.1 GB",
    tags: ["outdoor", "event", "austin", "music"],
    description: "Highlights from the Austin team offsite event.",
    transcript: "The Austin team gathered at Barton Springs for our quarterly offsite. The weather was perfect and the music from the local band set the right tone...",
    color: "#10b981",
  },
  {
    id: "5",
    title: "Investor Pitch – Series A",
    filename: "series_a_pitch.mp4",
    duration: "18:03",
    durationSeconds: 1083,
    uploadDate: "Jan 23, 2025",
    status: "processing",
    size: "1.7 GB",
    tags: ["investor", "pitch", "series-a", "presentation"],
    description: "Series A fundraising pitch deck walkthrough with the founding team.",
    transcript: "We are building the future of video intelligence. The market opportunity is...",
    color: "#ec4899",
  },
  {
    id: "6",
    title: "Engineering All-Hands – Feb",
    filename: "eng_allhands_feb.mp4",
    duration: "47:22",
    durationSeconds: 2842,
    uploadDate: "Jan 24, 2025",
    status: "processing",
    size: "4.5 GB",
    tags: ["engineering", "all-hands", "february"],
    description: "Engineering department all-hands for February 2025.",
    transcript: "",
    color: "#8b5cf6",
  },
  {
    id: "7",
    title: "Design Review – Homepage v3",
    filename: "design_review_v3.mp4",
    duration: "15:58",
    durationSeconds: 958,
    uploadDate: "Jan 25, 2025",
    status: "queued",
    size: "1.5 GB",
    tags: ["design", "review", "homepage"],
    description: "Design team walkthrough of the homepage redesign, version 3.",
    transcript: "",
    color: "#f97316",
  },
  {
    id: "8",
    title: "Sales Training Module 1",
    filename: "sales_training_01.mp4",
    duration: "28:30",
    durationSeconds: 1710,
    uploadDate: "Jan 26, 2025",
    status: "queued",
    size: "2.7 GB",
    tags: ["sales", "training", "onboarding"],
    description: "First module in the new sales training series for Q1 onboarding.",
    transcript: "",
    color: "#14b8a6",
  },
];

export const mockRecentSearches: RecentSearch[] = [
  { id: "1", query: "slides presentation product demo", timestamp: "2 hours ago", resultsCount: 4 },
  { id: "2", query: "outdoor footage with music", timestamp: "5 hours ago", resultsCount: 2 },
  { id: "3", query: "all interviews from January", timestamp: "Yesterday", resultsCount: 3 },
  { id: "4", query: "someone explaining architecture diagram", timestamp: "Yesterday", resultsCount: 1 },
  { id: "5", query: "team standup blockers", timestamp: "2 days ago", resultsCount: 6 },
];

export const mockSearchResults: SearchResult[] = [
  {
    id: "r1",
    video: mockVideos[0],
    matchedAt: "2:14",
    matchedAtSeconds: 134,
    endAt: "3:42",
    relevanceScore: 97,
    transcriptSnippet: "...and here on the slide you can see the new dashboard layout. We redesigned the entire navigation to make it more intuitive for users...",
  },
  {
    id: "r2",
    video: mockVideos[4],
    matchedAt: "4:50",
    matchedAtSeconds: 290,
    endAt: "6:10",
    relevanceScore: 91,
    transcriptSnippet: "...switching now to the slides, you'll see the market size breakdown we've put together. This is the TAM slide that our investors...",
  },
  {
    id: "r3",
    video: mockVideos[1],
    matchedAt: "1:05",
    matchedAtSeconds: 65,
    endAt: "2:20",
    relevanceScore: 78,
    transcriptSnippet: "...Alice pulled up the roadmap slides on the screen and walked everyone through the sprint plan for the next two weeks...",
  },
];

export const mockUploadQueue: UploadFile[] = [
  { id: "u1", filename: "q1_kickoff_2025.mp4", size: "2.3 GB", progress: 100, status: "complete" },
  { id: "u2", filename: "design_workshop.mov", size: "1.8 GB", progress: 64, status: "uploading" },
  { id: "u3", filename: "client_call_feb.mp4", size: "890 MB", progress: 23, status: "uploading" },
  { id: "u4", filename: "team_retreat.mp4", size: "5.1 GB", progress: 0, status: "uploading" },
];

export const mockStats = {
  totalVideos: 142,
  storageUsed: "284 GB",
  storageMax: 500,
  storageUsedGB: 284,
  videosProcessed: 138,
  searchesToday: 24,
};
