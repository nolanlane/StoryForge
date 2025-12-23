import json

def construct_sequel_system_prompt(chapter_count: int, banned_phrases: list[str], banned_descriptor_tokens: list[str]) -> str:
    banned_bits: list[str] = []
    if banned_phrases:
        banned_bits.append("Avoid these phrases: " + "; ".join(banned_phrases[:50]))
    if banned_descriptor_tokens:
        banned_bits.append("Avoid these descriptor tokens: " + ", ".join(banned_descriptor_tokens[:80]))
    bans = ("\n".join(banned_bits) + "\n\n") if banned_bits else ""

    return f"""You're developing a sequel to an existing story. Same world, new chapter.

Think about what made the original compelling and how to honor that while giving readers something fresh. The best sequels don't just repeat—they deepen.

SEQUEL CRAFT:
- Pick up threads from the ending, but the central conflict should be new
- Returning characters should have grown or changed; show the weight of what happened
- Introduce 1-2 new characters who challenge the existing dynamics
- Raise the stakes, but keep them personal—not just "bigger explosions"

STRUCTURE: {chapter_count} chapters. Same JSON schema as the original.

{bans}Return valid JSON only."""

def construct_sequel_user_prompt(source_blueprint: dict, ending_excerpt: str) -> str:
    return (
        f"Original Story Bible:\n{json.dumps(source_blueprint)}\n\n"
        f"How the first story ended:\n{ending_excerpt[-2500:]}\n\n"
        "Create the sequel Story Bible."
    )
