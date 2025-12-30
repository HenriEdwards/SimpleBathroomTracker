Fix “Download PDF failed” — Expo SDK 54 blocks legacy expo-file-system methods
Symptom

Download PDF throws:

Method getInfoAsync imported from "expo-file-system" is deprecated… migrate to new filesystem API or import legacy from "expo-file-system/legacy"

So our code is importing from:

import * as FileSystem from 'expo-file-system';


and using legacy calls like getInfoAsync, writeAsStringAsync, etc.

Fix (fastest, minimal change)

Switch Download-PDF code to use legacy import for the methods we rely on.

Steps

In export.tsx (or wherever Download PDF logic lives), change imports:

Replace:

import * as FileSystem from 'expo-file-system';


With:

import * as FileSystem from 'expo-file-system/legacy';


Ensure any other file that calls legacy methods (getInfoAsync, makeDirectoryAsync, copyAsync, writeAsStringAsync, readAsStringAsync, etc.) also imports from expo-file-system/legacy.

Keep StorageAccessFramework usage working:

If we reference FileSystem.StorageAccessFramework, confirm it exists in legacy import.

If not, then do this split import:

import * as FileSystemLegacy from 'expo-file-system/legacy';
import { StorageAccessFramework } from 'expo-file-system';


…and use:

FileSystemLegacy.writeAsStringAsync(...)

StorageAccessFramework.requestDirectoryPermissionsAsync(...), etc.

Remove any getInfoAsync pre-checks if they’re unnecessary. The SAF save flow doesn’t need getInfoAsync at all:

Generate PDF → get base64 (or file uri) → SAF create file → write.

Acceptance

“Download PDF” no longer errors.

It saves successfully (ideally via SAF folder picker).

No console error about deprecated legacy methods.