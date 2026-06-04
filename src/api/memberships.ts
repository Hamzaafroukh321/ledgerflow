export interface Membership {
  tenantId: string;
  userId: string;
  role: "viewer" | "editor" | "admin";
  email?: string;
}

export interface MembershipDirectory {
  list(tenantId: string): Membership[];
  save(membership: Membership): Membership;
}

export class MemoryMembershipDirectory implements MembershipDirectory {
  private readonly memberships = new Map<string, Membership>();

  public list(tenantId: string): Membership[] {
    return [...this.memberships.values()]
      .filter((membership) => membership.tenantId === tenantId)
      .sort((left, right) => left.userId.localeCompare(right.userId));
  }

  public save(membership: Membership): Membership {
    this.memberships.set(`${membership.tenantId}:${membership.userId}`, membership);
    return membership;
  }
}
