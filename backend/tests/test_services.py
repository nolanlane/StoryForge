from unittest.mock import MagicMock
from datetime import datetime
from backend.app.services import story_service, prompt_service
from backend.app.schemas import StoryUpsert

def test_story_service_lifecycle():
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = None

    # Mock user ID
    user_id = 1

    # Upsert
    req = StoryUpsert(
        id="test-story-1",
        title="My Test Story",
        genre="Sci-Fi",
        tone="Dark"
    )

    summary = story_service.upsert_story_for_user(mock_db, req, user_id)

    assert summary.id == "test-story-1"
    assert summary.title == "My Test Story"
    assert mock_db.add.called
    assert mock_db.commit.called

    # Get (Mock existing)
    mock_story = MagicMock()
    mock_story.id = "test-story-1"
    mock_story.user_id = user_id
    mock_story.title = "My Test Story"
    mock_story.config_json = "{}"
    mock_story.blueprint_json = "{}"
    mock_story.story_content_json = "{}"
    mock_story.story_images_json = "{}"

    mock_db.query.return_value.filter.return_value.first.return_value = mock_story

    fetched = story_service.get_story_for_user(mock_db, "test-story-1", user_id)
    assert fetched is not None
    assert fetched.title == "My Test Story"

    # Delete
    story_service.delete_story_for_user(mock_db, "test-story-1", user_id)
    assert mock_db.delete.called

def test_prompt_service_sequel_construction():
    sys_prompt = prompt_service.construct_sequel_system_prompt(
        chapter_count=5,
        banned_phrases=["Bad phrase"],
        banned_descriptor_tokens=["bad_token"]
    )
    assert "You're developing a sequel" in sys_prompt
    assert "STRUCTURE: 5 chapters" in sys_prompt
    assert "Avoid these phrases: Bad phrase" in sys_prompt

    user_prompt = prompt_service.construct_sequel_user_prompt(
        source_blueprint={"title": "Old Story"},
        ending_excerpt="The end."
    )
    assert "Original Story Bible" in user_prompt
    assert "Old Story" in user_prompt
    assert "The end." in user_prompt
