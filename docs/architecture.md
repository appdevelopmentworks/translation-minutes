# アーキテクチャ概要 v0.1

## クライアントのみ構成（MVP）
- Next.js App Router（Client Components中心）
- TailwindCSS + shadcn風UI（最小ラッパ） + framer-motion
- 音声取得: MediaDevices (`getUserMedia` / `getDisplayMedia`) → MediaRecorder (1–2秒チャンク)
- STT: Groq優先 → OpenAIにフォールバック（ユーザーAPIキー）。GroqはOpenAI互換の`/audio/transcriptions`を利用し、`response_format=verbose_json`でセグメント取得を試行。
- 後処理: フィラ除去/句読点整形（軽量）
- ストレージ: IndexedDB（音声/セッション/ドキュメント）、設定はlocalStorage
  - オプション: Prisma+SQLite（サーバ保存／自己ホスト用）。`SERVER_PERSISTENCE=1` の場合のみAPIを有効化し、`DATABASE_URL`でSQLiteを使用。
  - ローカルセッション: `components/LocalSessionPanel.tsx` から保存/読み込み。セッションIDの一覧は localStorage キーで管理し、本文は IndexedDB `sessions` に保存。

## 主要モジュール
- `lib/audio/recorder.ts`: 音源（マイク/タブ）からチャンク生成
- `lib/audio/vad.ts`: WebAudioベースの簡易VAD（無音→発話でターン検出）
- `lib/audio/vadWorklet.ts` + `public/worklets/vad-processor.js`: AudioWorklet版VAD（対応環境ではこちらを優先、失敗時に従来VADへフォールバック）
- `lib/stt/*`: Groq/OpenAIクライアントとフォールバック
  - 備考: `response_format=verbose_json` のとき、セグメント（start/end/text）を利用して `TranscriptSegment.startMs/endMs` に反映（録音/ファイル取り込み双方）。
- `lib/processing/text.ts`: フィラ除去・句読点整形
- `lib/storage/indexeddb.ts`: 簡易IndexedDBラッパ
- `lib/storage/localSessions.ts`: ローカルセッションの保存/更新/取得/削除
- `lib/types/session.ts`: ローカルセッション型
- `lib/state/settings.tsx`: 設定（APIキー/ON-OFF/言語）
- `lib/server/prisma.ts`: Prismaクライアント（サーバのみ）
- `app/api/sessions/*`: セッション/セグメントCRUD（実験的・既定OFF）
 - UI: `components/ServerSavePanel.tsx`（APIの有効可否を自己検出し、セッション作成/保存を提供）

## 画面
- トップ: 設定/録音コントロール/ライブ字幕/要約+出力
- 今後: 編集画面（話者名編集、ハイライト、コメント、履歴）

## ネットワーク方針
- 設定でSTT送信ON/OFF。OFF時は録音のみ（後処理はローカル）
- Groq失敗時はOpenAIへフォールバック
- 備考: CORS制約がある場合はNext.jsのRoute Handlerで薄いプロキシを用意（キーは保存せず転送のみ）。
 
## LLM（要約/翻訳）
- エンドポイント: `app/api/llm/complete`（POST）
- 入力: `{ task: "summary"|"translate", provider: "groq"|"openai", apiKey, text, sourceLang?, targetLang? }`
- 出力: `{ output: string }`
- Provider: OpenAI/Groq の chat completions（OpenAI互換）
- 逐次翻訳: クライアント側でキュー制御（最大2件の先読みを保持、250ms間隔で処理）

## エクスポートテンプレ
- 設定: 会議名/日付/参加者（`SettingsSheet`で編集）
- 出力: `TranscriptExportPanel` でヘッダに差し込み、要約付き出力にも反映

## ライブ字幕/音声ジャンプ
- ライブ字幕: `LiveTranscript` は `TranscriptSegment` を表示し、設定で時刻表示のON/OFFを切替
- 音声ジャンプ: `AudioPlayerProvider` + `AudioPlayerPanel` でローカル音声を読み込み、`EditorPanel` の「ジャンプ」ボタンで `startMs` にシーク（実験）

## ファイル取り込みの分割処理
- `FileTranscribePanel`: WebAudioでデコード→モノラル化→`chunkSeconds`ごとにWAVエンコード→STT逐次実行→進捗バー表示

## 後続
- 話者分離（VAD+クラスタリング）
- 用語辞書（md/pdf）取り込みと出力反映
- 翻訳・要約のAPI連携
