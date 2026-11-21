import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { FolderBrowserScreen } from '../../../../../../ui/FolderBrowserScreen';

export default function CourseFilesRootScreen() {
  const { courseID } = useLocalSearchParams<{ courseID: string }>();
  return <FolderBrowserScreen courseID={Number(courseID)} />;
}
