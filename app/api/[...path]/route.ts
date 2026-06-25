import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  return handleMock(request);
}

export async function POST(request: NextRequest) {
  return handleMock(request);
}

export async function PUT(request: NextRequest) {
  return handleMock(request);
}

export async function PATCH(request: NextRequest) {
  return handleMock(request);
}

export async function DELETE(request: NextRequest) {
  return handleMock(request);
}

async function handleMock(request: NextRequest) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/', '');

  if (path === 'auth/login') {
    return NextResponse.json({ access_token: "mock-token" });
  }
  if (path === 'auth/me') {
    return NextResponse.json({ id: 1, email: "admin@example.com", name: "Admin" });
  }
  if (path.startsWith('instagram/automation/rules')) return NextResponse.json({ rules: [], total: 0 });
  if (path.startsWith('instagram/automation/events')) return NextResponse.json({ events: [], total: 0 });
  if (path.startsWith('instagram/automation/simulate-comment')) return NextResponse.json({ received: 1, created: 1, duplicates: 0, matched: 1, queued: 1, skipped: 0, events: [] });
  if (path.startsWith('posts')) {
    return NextResponse.json([]);
  }
  if (path.startsWith('media')) {
    return NextResponse.json([]);
  }
  if (path.startsWith('campaigns')) {
    return NextResponse.json([]);
  }
  if (path.startsWith('channels/accounts')) {
    return NextResponse.json({
      accounts: [],
      summary: { total: 0, ready: 0, action_required: 0, channels: [] }
    });
  }
  if (path.startsWith('stores/active')) {
    return NextResponse.json({ id: 1, name: "فروشگاه نمونه", description: "This is a mock store" });
  }
  if (path.startsWith('rubika/settings') || path.startsWith('instagram/settings')) {
    return NextResponse.json({ active: true });
  }
  if (path.startsWith('notifications')) {
    return NextResponse.json({
      notifications: [],
      summary: { total: 0, action_required: 0, critical: 0, warning: 0, info: 0 }
    });
  }
  if (path.startsWith('publish-attempts')) {
    return NextResponse.json([]);
  }

  // Default response for any other mocked route
  return NextResponse.json({ success: true, mocked: true, data: [] });
}
