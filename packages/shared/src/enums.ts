export const Role = ['OWNER', 'ADMIN', 'MEMBER', 'GUEST', 'VIEWER'] as const;
export type Role = (typeof Role)[number];

export const Priority = ['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE'] as const;
export type Priority = (typeof Priority)[number];

export const StatusCategory = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELED'] as const;
export type StatusCategory = (typeof StatusCategory)[number];

export const ProposalState = ['NONE', 'PROPOSED', 'ACCEPTED', 'DECLINED'] as const;
export type ProposalState = (typeof ProposalState)[number];

export const Methodology = ['KANBAN', 'SCRUM', 'OKR', 'GTD', 'SHAPE_UP'] as const;
export type Methodology = (typeof Methodology)[number];

export const CalendarSystem = ['jalali', 'gregorian'] as const;
export type CalendarSystem = (typeof CalendarSystem)[number];
