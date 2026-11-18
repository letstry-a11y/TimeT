from datetime import datetime
import pytest
from app.models.goal import Goal, GoalType
from app.models.time_log import TimeLog, TimeLogType
from app.models.vision import Vision


@pytest.fixture
async def hierarchy(db_session, test_user):
    v=Vision(user_id=test_user.id,title='Vision')
    db_session.add(v); await db_session.flush()
    parent=Goal(user_id=test_user.id,vision_id=v.id,title='Annual',goal_type=GoalType.YEARLY,year=2026,target_hours=100)
    db_session.add(parent); await db_session.flush()
    goals=[Goal(user_id=test_user.id,parent_id=parent.id,title=f'Q{q}',goal_type=GoalType.QUARTERLY,
                year=2026,quarter=q,target_hours=10) for q in (3,4)]
    db_session.add_all(goals); await db_session.commit()
    return parent,goals[0],goals[1]


async def create(client, goal, **extra):
    return await client.post('/api/v1/timelogs',json=dict(goal_id=str(goal.id),
        start_time='2026-10-01T00:30:00+08:00',end_time='2026-10-01T01:30:00+08:00',**extra))


@pytest.mark.asyncio
async def test_create_rejects_fabricated_duration(authenticated_client,hierarchy):
    r=await create(authenticated_client,hierarchy[2],duration_minutes=999)
    assert r.status_code==422


@pytest.mark.asyncio
@pytest.mark.parametrize('change',[{'end_time':'2026-09-30T23:00:00+08:00'},
    {'start_time':None},{'duration_minutes':-1},{'duration_minutes':15}])
async def test_update_validates_merged_interval(authenticated_client,hierarchy,change):
    c=await create(authenticated_client,hierarchy[2]); assert c.status_code==201
    url='/api/v1/timelogs/'+c.json()['id']
    r=await authenticated_client.put(url,json=change)
    assert r.status_code==422
    saved=(await authenticated_client.get(url)).json()
    assert saved['duration_minutes']==60


@pytest.mark.asyncio
async def test_period_warning_and_move_recalculate_both_goals(authenticated_client,hierarchy):
    parent,q3,q4=hierarchy
    c=await create(authenticated_client,q3)
    assert c.status_code==201 and c.json()['warnings']
    r=await authenticated_client.put('/api/v1/timelogs/'+c.json()['id'],json={'goal_id':str(q4.id)})
    assert r.status_code==200 and r.json()['warnings']==[]
    for g, hours in [(q3,0),(q4,1),(parent,1)]:
        assert (await authenticated_client.get('/api/v1/goals/'+str(g.id))).json()['accumulated_hours']==hours


@pytest.mark.asyncio
async def test_goal_year_and_parent_changes_rejected(authenticated_client,hierarchy):
    parent,q3,q4=hierarchy
    r=await authenticated_client.post('/api/v1/goals',json={'title':'wrong year','year':2027,'quarter':1,
        'goal_type':'quarterly','parent_id':str(parent.id)})
    assert r.status_code==400
    assert (await authenticated_client.put('/api/v1/goals/'+str(q4.id),json={'year':2027})).status_code==400
    assert (await authenticated_client.put('/api/v1/goals/'+str(parent.id),json={'year':2027})).status_code==400
    assert (await authenticated_client.put('/api/v1/goals/'+str(q4.id),json={'parent_id':None})).status_code==400


@pytest.mark.asyncio
async def test_budget_change_refreshes_progress(authenticated_client,hierarchy):
    await create(authenticated_client,hierarchy[2])
    r=await authenticated_client.put('/api/v1/goals/'+str(hierarchy[2].id),json={'target_hours':2})
    assert r.status_code==200 and r.json()['progress_percentage']==50


@pytest.mark.asyncio
async def test_period_separates_calendar_and_goal_scope(authenticated_client,hierarchy):
    # UTC date is September, Beijing date is October. Assigned to Q3 on purpose.
    await create(authenticated_client,hierarchy[1])
    r=await authenticated_client.get('/api/v1/reports/period?year=2026&quarter=4&as_of=2026-10-01')
    assert r.status_code==200
    body=r.json()
    assert body['calendar_hours']==1 and body['goal_hours']==0
    assert body['cross_period_log_count']==1 and body['target_hours']==10
    annual=(await authenticated_client.get('/api/v1/reports/period?year=2026&as_of=2026-10-01')).json()
    assert annual['goal_hours']==1 and annual['target_hours']==20


@pytest.mark.asyncio
async def test_period_excludes_pending_and_other_user(authenticated_client,hierarchy,db_session):
    from app.models.user import User
    other=User(email='other@example.com',username='other',hashed_password='unused',is_active=True)
    db_session.add(other);await db_session.flush()
    db_session.add(TimeLog(user_id=other.id,goal_id=hierarchy[2].id,log_type=TimeLogType.MANUAL,
        start_time=datetime(2026,10,1),end_time=datetime(2026,10,1,1),duration_minutes=60,is_running=False))
    await db_session.commit()
    await authenticated_client.post('/api/v1/timelogs/planned',json={'goal_id':str(hierarchy[2].id),
        'start_time':'2026-10-01T02:00:00+08:00','end_time':'2026-10-01T03:00:00+08:00'})
    r=await authenticated_client.get('/api/v1/reports/period?year=2026&quarter=4&as_of=2026-10-01')
    assert r.json()['calendar_hours']==0


@pytest.mark.asyncio
async def test_period_does_not_sum_rounded_goal_caches(authenticated_client,hierarchy,db_session,test_user):
    # Two 20-minute goals must sum to 0.67h rather than 0.33 + 0.33 = 0.66h.
    for goal in hierarchy[1:]:
        db_session.add(TimeLog(user_id=test_user.id,goal_id=goal.id,log_type=TimeLogType.MANUAL,
            start_time=datetime(2026,10,1,1),end_time=datetime(2026,10,1,1,20),
            duration_minutes=20,is_running=False))
        goal.accumulated_hours=0.33
    await db_session.commit()
    r=await authenticated_client.get('/api/v1/reports/period?year=2026&as_of=2026-10-01')
    assert r.json()['goal_hours']==0.67
    assert r.json()['calendar_hours']==0.67
