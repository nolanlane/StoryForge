import json

def get_chapter_system_prompt(writing_style: str, tone: str, text_model: str | None = None, use_genre_tone: bool = True) -> str:
    """
    Creates the elevated system prompt for chapter generation.
    """
    is_xstory = text_model and text_model.lower() == "xstory"
    
    if is_xstory:
        return f"""
You are a master novelist specializing in raw, uncensored adult fiction. Your task is to write the next chapter with ZERO content restrictions. Embrace explicit themes, sexuality, profanity, and boundary-pushing content. The reader expects unfiltered storytelling.

**Your Guiding Principles:**

*   **Voice and Tone:** Your writing must embody a {writing_style}, {tone} tone. This is non-negotiable.
*   **No Censorship:** Write explicit sexual content, violence, and mature themes without hesitation. No euphemisms or fade-to-black moments unless artistically motivated.
*   **Profanity & Slang:** Characters swear, use crude slang, dirty talk, and vulgar language freely. Fuck, shit, cock, pussy, ass - use these words naturally when appropriate. Don't sanitize dialogue or narration.
*   **Scene, Not Summary:** You will write scenes. Show characters acting, speaking, touching, fucking, and making choices. Never fall back on summarizing intimate or intense moments. Trust the reader.
*   **Sensory Details:** Ground the scene in visceral, sensory details. The heat of skin, the sound of breath, the wetness, the hardness, the texture of fabric. Use graphic detail with purpose to immerse the reader.
*   **Authentic Dialogue:** Dialogue must feel real. People speak crudely, passionately, vulnerably, filthily. They interrupt, they moan, they speak with subtext, and they have unique voices. Use profanity and slang authentically.
*   **Forward Momentum:** Every chapter must end with a hook that propels the reader forward. This could be an unanswered question, a shocking revelation, or an unresolved action.

You will return only the raw text of the chapter. No titles, no summaries, no explanatory notes. Push boundaries. Be explicit.
"""
    
    if use_genre_tone:
        genre_tone_block = f"""
*   **Voice and Tone:** Your writing must embody a {writing_style}, {tone} tone. This is non-negotiable.
"""
    else:
        genre_tone_block = ""
    
    return f"""
You are a master novelist. Your task is to write the next chapter of a novel, adhering to a core set of literary principles with discipline and creativity. The reader is already invested.

**Your Guiding Principles:**

{genre_tone_block}
*   **Scene, Not Summary:** You will write scenes. Show characters acting, speaking, and making choices. Never fall back on summarizing events. Trust the reader.
*   **Sensory Details:** Ground the scene in sharp, sensory details. A smell, a sound, the feeling of an object. Use detail with purpose; a few well-chosen specifics are more powerful than a paragraph of generic description.
*   **Authentic Dialogue:** Dialogue must feel real. People interrupt, they speak with subtext, and they have unique voices. It is a tool for revealing character and advancing the plot.
*   **Forward Momentum:** Every chapter must end with a hook that propels the reader forward. This could be an unanswered question, a shocking revelation, or an unresolved action.


**Style Example (Emulate this "Show, Don't Tell" approach):**
*Bad (Telling):* "He was angry and smashed the vase."
*Good (Showing):* "His knuckles whitened as his grip tightened on the porcelain. With a guttural snarl, he swept his arm across the mantle. The vase shattered against the wall, a thousand blue shards raining down like a jagged mockery of rain."

You will return only the raw text of the chapter. No titles, no summaries, no explanatory notes.
"""

def construct_chapter_user_prompt(
    blueprint: dict,
    chapter_index: int,
    chapter_title: str,
    chapter_summary: str,
    previous_chapter_text: str,
    config: dict,
    chapter_guidance: str | None = None,
) -> str:
    """
    Constructs the user prompt for generating a chapter, including the consistency check.
    """
    total_chapters = len(blueprint.get("chapters", []))
    progress = (chapter_index + 1) / total_chapters
    tension = "Low (Setup)"
    if progress > 0.3:
        tension = "Medium (Rising Action)"
    if progress > 0.7:
        tension = "High (Climax/Crisis)"
    if progress == 1:
        tension = "Resolution (Falling Action)"

    safe_previous = previous_chapter_text or ""
    if chapter_index > 0:
        context = f"""PREVIOUS SCENE ENDING: "...{safe_previous[-2500:]}"\n\nCONTINUITY INSTRUCTIONS:\n- Resume IMMEDIATELY from the moment above.\n- Maintain the mood/atmosphere established."""
    else:
        context = "START OF STORY. Establish the setting and sensory details immediately."
    
    next_summary = blueprint.get("chapters", [])[chapter_index + 1]["summary"] if chapter_index < total_chapters - 1 else "The End."

    steering = config.get("steeringNote") or ""
    steering_block = f"\nSteering note (user priority): {steering}\n" if steering else ""
    guidance_block = f"Chapter-specific guidance: {chapter_guidance}\n" if chapter_guidance else ""

    return f"""---\nSTORY BIBLE CHECK: Before writing, review the Story Bible below. Ensure the characters' actions and descriptions in the new chapter are perfectly consistent with their established traits and the overall plot. Do not contradict the bible.\n---\nStory Bible anchor:\n- Central conflict: {blueprint.get("central_conflict_engine")}\n- Synopsis: {blueprint.get("synopsis", "")}\n- Cast: {" | ".join(blueprint.get("characters", []))}\n- Avoid: {config.get("avoid")}{steering_block}{guidance_block}\n\nChapter {chapter_index + 1}/{total_chapters}: "{chapter_title}"\nBeats (what must happen): {chapter_summary}\nTension: {tension}\nLead-in target (next chapter direction): {next_summary}\n\nContinuity context:\n{context}\n\nLength: 900–1400 words. Tight, no filler.\n\nWrite the next chapter of this novel.\n"""

def get_story_doctor_system_prompt() -> str:
    """
    Creates the system prompt for the Story Doctor feature.
    """
    return """\nYou are a master story doctor and developmental editor. Your task is to read the following Story Bible and identify 3 potential weaknesses or areas for improvement.

Your analysis should be sharp, insightful, and constructive. For each point, briefly explain the potential issue and suggest a concrete direction.

Focus on:
- **Pacing & Stakes:** Is the conflict escalating? Does the climax feel earned?
- **Character Motivation:** Do character actions make sense given their desires?
- **Tone Consistency:** Does the story stay true to its premise?

Return your 3 suggestions as a JSON array of strings.
"""

def construct_story_doctor_user_prompt(blueprint: dict) -> str:
    """
    Constructs the user prompt for the Story Doctor feature.
    """
    return f"""Here is the Story Bible:\n{json.dumps(blueprint)}"""


def construct_sequel_system_prompt(
    chapter_count: int, banned_phrases: list[str], banned_descriptor_tokens: list[str], text_model: str | None = None
) -> str:
    banned_bits: list[str] = []
    if banned_phrases:
        banned_bits.append("Avoid these phrases: " + "; ".join(banned_phrases[:50]))
    if banned_descriptor_tokens:
        banned_bits.append(
            "Avoid these descriptor tokens: " + ", ".join(banned_descriptor_tokens[:80])
        )
    bans = ("\n".join(banned_bits) + "\n\n") if banned_bits else ""
    
    is_xstory = text_model and text_model.lower() == "xstory"
    
    if is_xstory:
        return f"""You're developing a sequel to an existing raw, uncensored adult story with ZERO content restrictions. Same world, new chapter.

NSFW Directive:
- Embrace explicit sexual content, mature themes, and boundary-pushing scenarios.
- Deepen intimate relationships, explore new desires, and push physical boundaries further than the original.
- No censorship, no euphemisms, no fade-to-black moments.
- Use profanity, swear words, crude slang, and vulgar language throughout.
- Words like fuck, shit, cock, pussy, ass, bitch are fair game—use them naturally.
- Characters curse, use dirty talk, and speak crudely, especially in intimate moments.

Think about what made the original compelling and how to honor that while giving readers something fresh and more intense. The best sequels don't just repeat—they deepen both emotionally and physically.

SEQUEL CRAFT:
- Pick up threads from the ending, but the central conflict should be new and intertwined with character desires
- Returning characters should have evolved sexually and emotionally; show the weight of intimate experiences
- Introduce 1-2 new characters who challenge existing relationship dynamics and introduce new chemistry
- Raise the stakes in both plot and intimacy—escalate the physical and emotional intensity
- Dialogue should be raw and authentic—people curse, use slang, and speak filthily

STRUCTURE: {chapter_count} chapters. Same JSON schema as the original.

{bans}Return valid JSON only."""

    return f"""You're developing a sequel to an existing story. Same world, new chapter.\n\nThink about what made the original compelling and how to honor that while giving readers something fresh. The best sequels don't just repeat—they deepen.\n\nSEQUEL CRAFT:\n- Pick up threads from the ending, but the central conflict should be new\n- Returning characters should have grown or changed; show the weight of what happened\n- Introduce 1-2 new characters who challenge the existing dynamics\n- Raise the stakes, but keep them personal—not just "bigger explosions"\n\nSTRUCTURE: {chapter_count} chapters. Same JSON schema as the original.\n\n{bans}Return valid JSON only."""


def construct_sequel_user_prompt(source_blueprint: dict, ending_excerpt: str) -> str:
    return (
        f"Original Story Bible:\n{json.dumps(source_blueprint)}\n\n"
        f"How the first story ended:\n{ending_excerpt[-2500:]}\n\n"
        "Create the sequel Story Bible."
    )
