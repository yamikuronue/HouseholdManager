"""Service for aggregating events from multiple calendars."""

from typing import List, Dict, Any
from datetime import datetime
from src.services.google_calendar import GoogleCalendarService


class CalendarAggregationService:
    """Service for merging events from multiple calendars."""
    
    def __init__(self, calendar_service: GoogleCalendarService):
        """Initialize with calendar service."""
        self.calendar_service = calendar_service
    
    def get_aggregated_events(
        self,
        calendar_ids: List[str],
        start_date: datetime,
        end_date: datetime
    ) -> List[Dict[str, Any]]:
        """Get and merge events from multiple calendars."""
        all_events = []
        
        for calendar_id in calendar_ids:
            events = self.calendar_service.get_events(
                calendar_id, start_date, end_date
            )
            # Add calendar_id to each event for identification
            for event in events:
                event['calendar_id'] = calendar_id
            all_events.extend(events)
        
        # Sort by start time
        sorted_events = sorted(
            all_events,
            key=lambda x: x.get('start', {}).get('dateTime', '')
        )
        
        return sorted_events
