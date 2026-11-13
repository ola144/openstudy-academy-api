export const subjectWithProgress = (topics: any[], subjects: any[]) => {
  return subjects.map((subject) => {
    const subjectTopics = topics.filter(
      (topic) => topic.subjectId._id.toString() === subject._id.toString(),
    );

    const completedSubjectTopics = subjectTopics.filter(
      (topic) => topic.isComplete,
    );

    const totalTopics = subjectTopics.length;
    const completedCount = completedSubjectTopics.length;

    const progress =
      totalTopics > 0 ? Math.round((completedCount / totalTopics) * 100) : 0;

    return {
      id: subject._id,
      name: subject.name,
      totalTopics,
      completedTopics: completedCount,
      progress,
    };
  });
};
