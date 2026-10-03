// Models for docs, chat, focus and gamification (see apps/web/lib/types.ts).

import 'models.dart';

DateTime? _date(Object? v) => v == null ? null : DateTime.parse(v as String).toLocal();

class DocBrief {
  const DocBrief({required this.id, this.parentId, required this.title, this.icon, required this.kind, required this.updatedAt, this.meetingAt});

  final String id;
  final String? parentId;
  final String title;
  final String? icon;
  final String kind;
  final DateTime updatedAt;
  final DateTime? meetingAt;

  bool get isMeeting => kind == 'MEETING';

  factory DocBrief.fromJson(Json j) => DocBrief(
    id: j['id'] as String,
    parentId: j['parentId'] as String?,
    title: j['title'] as String? ?? '',
    icon: j['icon'] as String?,
    kind: j['kind'] as String? ?? 'PAGE',
    updatedAt: _date(j['updatedAt']) ?? DateTime.now(),
    meetingAt: _date(j['meetingAt']),
  );
}

class DocDetail extends DocBrief {
  const DocDetail({
    required super.id,
    super.parentId,
    required super.title,
    super.icon,
    required super.kind,
    required super.updatedAt,
    super.meetingAt,
    required this.content,
    this.cover,
    required this.children,
    required this.breadcrumbs,
    required this.attendeeIds,
  });

  final Json content;
  final String? cover;
  final List<DocBrief> children;
  final List<DocBrief> breadcrumbs;
  final List<String> attendeeIds;

  factory DocDetail.fromJson(Json j) {
    final b = DocBrief.fromJson(j);
    return DocDetail(
      id: b.id,
      parentId: b.parentId,
      title: b.title,
      icon: b.icon,
      kind: b.kind,
      updatedAt: b.updatedAt,
      meetingAt: b.meetingAt,
      content: (j['content'] as Json?) ?? const {'type': 'doc', 'content': []},
      cover: j['cover'] as String?,
      children: [for (final c in (j['children'] as List? ?? const [])) DocBrief.fromJson(c as Json)],
      breadcrumbs: [
        for (final c in (j['breadcrumbs'] as List? ?? const []))
          DocBrief.fromJson({...(c as Json), 'kind': 'PAGE', 'updatedAt': DateTime.now().toIso8601String()}),
      ],
      attendeeIds: [for (final a in (j['attendeeIds'] as List? ?? const [])) a as String],
    );
  }
}

class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.channelId,
    this.parentId,
    required this.text,
    required this.author,
    required this.reactions,
    this.taskId,
    required this.replyCount,
    required this.createdAt,
    this.editedAt,
    this.deletedAt,
  });

  final String id;
  final String channelId;
  final String? parentId;
  final String text;
  final UserBrief author;
  final Map<String, List<String>> reactions;
  final String? taskId;
  final int replyCount;
  final DateTime createdAt;
  final DateTime? editedAt;
  final DateTime? deletedAt;

  factory ChatMessage.fromJson(Json j) => ChatMessage(
    id: j['id'] as String,
    channelId: j['channelId'] as String,
    parentId: j['parentId'] as String?,
    text: j['text'] as String? ?? '',
    author: UserBrief.fromJson(j['author'] as Json),
    reactions: {
      for (final e in ((j['reactions'] as Json?) ?? const {}).entries) e.key: [for (final u in e.value as List) u as String],
    },
    taskId: j['taskId'] as String?,
    replyCount: j['replyCount'] as int? ?? 0,
    createdAt: _date(j['createdAt'])!,
    editedAt: _date(j['editedAt']),
    deletedAt: _date(j['deletedAt']),
  );
}

class Channel {
  const Channel({required this.id, required this.kind, required this.name, this.topic, this.emoji, required this.members, required this.unread, this.last});

  final String id;
  final String kind;
  final String name;
  final String? topic;
  final String? emoji;
  final List<UserBrief> members;
  final int unread;
  final ChatMessage? last;

  bool get isDirect => kind == 'DIRECT';

  /// Channel name, or the other person's name for a DM.
  String title(String meId) => isDirect ? members.firstWhere((m) => m.id != meId, orElse: () => members.first).name : name;

  factory Channel.fromJson(Json j) => Channel(
    id: j['id'] as String,
    kind: j['kind'] as String,
    name: j['name'] as String,
    topic: j['topic'] as String?,
    emoji: j['emoji'] as String?,
    members: [for (final m in (j['members'] as List? ?? const [])) UserBrief.fromJson(m as Json)],
    unread: j['unread'] as int? ?? 0,
    last: j['last'] == null ? null : ChatMessage.fromJson(j['last'] as Json),
  );
}

class FocusStats {
  const FocusStats({
    this.currentId,
    this.currentStartedAt,
    this.currentMinutes,
    this.currentKind,
    this.currentTaskTitle,
    required this.todayMinutes,
    required this.todayCount,
    required this.streak,
  });

  final String? currentId;
  final DateTime? currentStartedAt;
  final int? currentMinutes;
  final String? currentKind;
  final String? currentTaskTitle;
  final int todayMinutes;
  final int todayCount;
  final int streak;

  factory FocusStats.fromJson(Json j) {
    final c = j['current'] as Json?;
    final today = (j['today'] as Json?) ?? const {};
    return FocusStats(
      currentId: c?['id'] as String?,
      currentStartedAt: _date(c?['startedAt']),
      currentMinutes: c?['plannedMin'] as int?,
      currentKind: c?['kind'] as String?,
      currentTaskTitle: (c?['task'] as Json?)?['title'] as String?,
      todayMinutes: today['minutes'] as int? ?? 0,
      todayCount: today['count'] as int? ?? 0,
      streak: j['streak'] as int? ?? 0,
    );
  }
}

class GameMember {
  const GameMember({
    required this.user,
    required this.xp,
    required this.weekXp,
    required this.level,
    required this.progress,
    required this.next,
    required this.streak,
    required this.bestStreak,
    required this.done,
    required this.badges,
  });

  final UserBrief user;
  final int xp;
  final int weekXp;
  final int level;
  final double progress;
  final int next;
  final int streak;
  final int bestStreak;
  final int done;
  final List<String> badges;

  factory GameMember.fromJson(Json j) => GameMember(
    user: UserBrief.fromJson(j['user'] as Json),
    xp: j['xp'] as int,
    weekXp: j['weekXp'] as int,
    level: j['level'] as int,
    progress: (j['progress'] as num).toDouble(),
    next: j['next'] as int,
    streak: (j['streak'] as Json)['current'] as int,
    bestStreak: (j['streak'] as Json)['best'] as int,
    done: j['done'] as int,
    badges: [for (final b in j['badges'] as List) (b as Json)['key'] as String],
  );
}
