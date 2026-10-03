// Plain models mirroring the API's JSON (see apps/web/lib/types.ts).

typedef Json = Map<String, dynamic>;

DateTime? _date(Object? v) => v == null ? null : DateTime.parse(v as String).toLocal();

class UserBrief {
  const UserBrief({required this.id, required this.name, this.email = '', this.avatarUrl, this.role});

  final String id;
  final String name;
  final String email;
  final String? avatarUrl;
  final String? role;

  factory UserBrief.fromJson(Json j) => UserBrief(
    id: j['id'] as String,
    name: j['name'] as String? ?? '',
    email: j['email'] as String? ?? '',
    avatarUrl: j['avatarUrl'] as String?,
    role: j['role'] as String?,
  );
}

class User extends UserBrief {
  const User({required super.id, required super.name, required super.email, super.avatarUrl, required this.locale});

  final String locale;

  factory User.fromJson(Json j) => User(
    id: j['id'] as String,
    name: j['name'] as String,
    email: j['email'] as String,
    avatarUrl: j['avatarUrl'] as String?,
    locale: j['locale'] as String? ?? 'fa',
  );
}

class Workspace {
  const Workspace({required this.id, required this.name, required this.role});

  final String id;
  final String name;
  final String role;

  factory Workspace.fromJson(Json j) => Workspace(id: j['id'] as String, name: j['name'] as String, role: j['role'] as String? ?? 'MEMBER');
}

class Status {
  const Status({required this.id, required this.name, required this.category, required this.color});

  final String id;
  final String name;
  final String category;
  final String color;

  factory Status.fromJson(Json j) => Status(id: j['id'] as String, name: j['name'] as String, category: j['category'] as String, color: j['color'] as String);
}

class Project {
  const Project({required this.id, required this.key, required this.name, this.icon, this.color, required this.statuses, this.total = 0, this.done = 0});

  final String id;
  final String key;
  final String name;
  final String? icon;
  final String? color;
  final List<Status> statuses;
  final int total;
  final int done;

  factory Project.fromJson(Json j) {
    final counts = (j['counts'] as Json?) ?? const {};
    return Project(
      id: j['id'] as String,
      key: j['key'] as String,
      name: j['name'] as String,
      icon: j['icon'] as String?,
      color: j['color'] as String?,
      statuses: [for (final s in (j['statuses'] as List? ?? const [])) Status.fromJson(s as Json)],
      total: counts['total'] as int? ?? 0,
      done: counts['DONE'] as int? ?? 0,
    );
  }
}

class Label {
  const Label({required this.id, required this.name, required this.color});

  final String id;
  final String name;
  final String color;

  factory Label.fromJson(Json j) => Label(id: j['id'] as String, name: j['name'] as String, color: j['color'] as String);
}

class ChecklistItem {
  const ChecklistItem({required this.id, required this.text, required this.done});

  final String id;
  final String text;
  final bool done;

  factory ChecklistItem.fromJson(Json j) => ChecklistItem(id: j['id'] as String, text: j['text'] as String, done: j['done'] as bool);
}

class Task {
  const Task({
    required this.id,
    required this.key,
    required this.projectId,
    required this.title,
    required this.statusId,
    required this.status,
    required this.projectName,
    this.projectIcon,
    this.projectColor,
    required this.priority,
    this.dueAt,
    this.completedAt,
    required this.createdById,
    required this.proposalState,
    this.proposedDueAt,
    this.proposalNote,
    required this.orderKey,
    required this.assignees,
    required this.labels,
    required this.checklistDone,
    required this.checklistTotal,
    required this.comments,
    required this.subtaskCount,
    this.description,
    this.checklistItems = const [],
    this.subtasks = const [],
    this.createdBy,
    this.createdAt,
  });

  final String id;
  final String key;
  final String projectId;
  final String title;
  final String statusId;
  final Status status;
  final String projectName;
  final String? projectIcon;
  final String? projectColor;
  final String priority;
  final DateTime? dueAt;
  final DateTime? completedAt;
  final String createdById;
  final String proposalState;
  final DateTime? proposedDueAt;
  final String? proposalNote;
  final String orderKey;
  final List<UserBrief> assignees;
  final List<Label> labels;
  final int checklistDone;
  final int checklistTotal;
  final int comments;
  final int subtaskCount;
  final String? description;
  final List<ChecklistItem> checklistItems;
  final List<Task> subtasks;
  final UserBrief? createdBy;
  final DateTime? createdAt;

  bool get isDone => status.category == 'DONE';
  List<UserBrief> get owners => assignees.where((a) => a.role == null || a.role == 'ASSIGNEE').toList();

  factory Task.fromJson(Json j) {
    final project = j['project'] as Json;
    final checklist = j['checklist'];
    final counts = (j['counts'] as Json?) ?? const {};
    return Task(
      id: j['id'] as String,
      key: j['key'] as String,
      projectId: j['projectId'] as String,
      title: j['title'] as String,
      statusId: j['statusId'] as String,
      status: Status.fromJson(j['status'] as Json),
      projectName: project['name'] as String,
      projectIcon: project['icon'] as String?,
      projectColor: project['color'] as String?,
      priority: j['priority'] as String,
      dueAt: _date(j['dueAt']),
      completedAt: _date(j['completedAt']),
      createdById: j['createdById'] as String,
      proposalState: j['proposalState'] as String? ?? 'NONE',
      proposedDueAt: _date(j['proposedDueAt']),
      proposalNote: j['proposalNote'] as String?,
      orderKey: j['orderKey'] as String,
      assignees: [for (final a in j['assignees'] as List) UserBrief.fromJson(a as Json)],
      labels: [for (final l in j['labels'] as List) Label.fromJson(l as Json)],
      checklistDone: checklist is Map ? checklist['done'] as int : 0,
      checklistTotal: checklist is Map ? checklist['total'] as int : 0,
      comments: counts['comments'] as int? ?? 0,
      subtaskCount: counts['subtasks'] as int? ?? 0,
      description: (j['description'] as Json?)?['text'] as String?,
      checklistItems: [for (final c in (j['checklistItems'] as List? ?? const [])) ChecklistItem.fromJson(c as Json)],
      subtasks: [for (final s in (j['subtasks'] as List? ?? const [])) Task.fromJson(s as Json)],
      createdBy: j['createdBy'] == null ? null : UserBrief.fromJson(j['createdBy'] as Json),
      createdAt: _date(j['createdAt']),
    );
  }
}

class Comment {
  const Comment({required this.id, required this.author, required this.text, required this.createdAt});

  final String id;
  final UserBrief author;
  final String text;
  final DateTime createdAt;

  factory Comment.fromJson(Json j) => Comment(
    id: j['id'] as String,
    author: UserBrief.fromJson(j['author'] as Json),
    text: (j['body'] as Json)['text'] as String,
    createdAt: _date(j['createdAt'])!,
  );
}

class AppNotification {
  const AppNotification({required this.id, required this.type, required this.payload, this.actor, this.readAt, required this.createdAt});

  final String id;
  final String type;
  final Json payload;
  final UserBrief? actor;
  final DateTime? readAt;
  final DateTime createdAt;

  factory AppNotification.fromJson(Json j) => AppNotification(
    id: j['id'] as String,
    type: j['type'] as String,
    payload: j['payload'] as Json,
    actor: j['actor'] == null ? null : UserBrief.fromJson(j['actor'] as Json),
    readAt: _date(j['readAt']),
    createdAt: _date(j['createdAt'])!,
  );
}

class TeamMember extends UserBrief {
  const TeamMember({required super.id, required super.name, super.email, super.avatarUrl, super.role, required this.open, required this.doneThisWeek});

  final int open;
  final int doneThisWeek;

  factory TeamMember.fromJson(Json j) => TeamMember(
    id: j['id'] as String,
    name: j['name'] as String,
    email: j['email'] as String? ?? '',
    avatarUrl: j['avatarUrl'] as String?,
    role: j['role'] as String?,
    open: j['open'] as int,
    doneThisWeek: j['doneThisWeek'] as int,
  );
}

class Dashboard {
  const Dashboard({
    required this.open,
    required this.overdue,
    required this.doneThisWeek,
    required this.doneDelta,
    required this.completionRate,
    required this.days,
    required this.team,
    required this.myFocus,
    required this.upcoming,
  });

  final int open;
  final int overdue;
  final int doneThisWeek;
  final int doneDelta;
  final int completionRate;
  final List<({DateTime date, int count, int delta})> days;
  final List<TeamMember> team;
  final List<Task> myFocus;
  final List<Task> upcoming;

  factory Dashboard.fromJson(Json j) {
    final k = j['kpis'] as Json;
    return Dashboard(
      open: k['open'] as int,
      overdue: k['overdue'] as int,
      doneThisWeek: k['doneThisWeek'] as int,
      doneDelta: k['doneDelta'] as int,
      completionRate: k['completionRate'] as int,
      days: [
        for (final d in j['completedByDay'] as List)
          (date: DateTime.parse((d as Json)['date'] as String).toLocal(), count: d['count'] as int, delta: d['delta'] as int),
      ],
      team: [for (final m in j['team'] as List) TeamMember.fromJson(m as Json)],
      myFocus: [for (final t in j['myFocus'] as List) Task.fromJson(t as Json)],
      upcoming: [for (final t in j['upcoming'] as List) Task.fromJson(t as Json)],
    );
  }
}
