import datetime


def format_timestamp(second: float) -> str:
    td = datetime.timedelta(seconds=second)
    total_seconds = int(td.total_seconds())
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"


def generate_srt_content(segments, start_offset, duration):
    srt_lines = []
    for i, seg in enumerate(segments):
        if seg['start'] < start_offset:
            continue
        if seg['start'] > start_offset + duration:
            break

        rel_start = max(0, seg['start'] - start_offset)
        rel_end = min(duration, seg['end'] - start_offset)

        srt_lines.append(f"{i + 1}")
        srt_lines.append(f"{format_timestamp(rel_start)} --> {format_timestamp(rel_end)}")
        srt_lines.append(f"{seg['text'].strip().upper()}")
        srt_lines.append("")  # Blank line
    return "\n".join(srt_lines)
