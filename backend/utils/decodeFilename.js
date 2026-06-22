/**
 * 智能解码 multer/busboy 传来的 multipart 文件名
 *
 * 背景：Node.js HTTP 解析器将 header 值存储为 latin1 字符串。
 * multer/busboy 在不同版本/配置下行为不一致：
 *   - 某些情况下直接返回 latin1 字符串（需要 latin1→utf8 转换）
 *   - 某些情况下已自动解码为 UTF-8（直接使用即可）
 *
 * 策略：检测字符串中是否包含超出 latin1 范围的字符（code point > 255）。
 *   - 如果有 → 已经是正确 UTF-8，直接返回
 *   - 如果没有 → 尝试 latin1→utf8 转换，如果转换后包含有效中文则使用转换结果，否则保留原值
 */

export function decodeMultipartFilename(raw) {
  if (!raw || typeof raw !== 'string') return raw || ''

  // 如果字符串包含 code point > 255 的字符，说明已经是正确解码的 UTF-8
  for (let i = 0; i < raw.length; i++) {
    if (raw.charCodeAt(i) > 255) {
      return raw
    }
  }

  // 所有字符都在 latin1 范围内，尝试 latin1→utf8 转换
  try {
    const decoded = Buffer.from(raw, 'latin1').toString('utf8')
    // 检查解码后是否包含有效的多字节字符（中文等）
    // 如果解码后的字符串与原始字符串不同，说明确实发生了转换
    if (decoded !== raw) {
      // 验证解码结果是合法 UTF-8
      try {
        Buffer.from(decoded, 'utf8')
        return decoded
      } catch {
        return raw
      }
    }
  } catch {
    // ignore
  }

  return raw
}
