import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { FolderBrowserScreen } from '../../../../../../ui/FolderBrowserScreen';

export default function CourseFolderScreen() {
  const { courseID, folderID } = useLocalSearchParams<{ courseID: string; folderID: string }>();
  const parsedFolderID = folderID !== undefined ? Number(folderID) : undefined;
  return (
    <FolderBrowserScreen
      courseID={Number(courseID)}
      folderID={parsedFolderID !== undefined && !Number.isNaN(parsedFolderID) ? parsedFolderID : undefined}
    />
  );
}
