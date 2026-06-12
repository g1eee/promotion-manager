import type { ReactNode } from "react";
import { Stack } from "./Stack";

export interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  rightContent?: ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  rightContent,
}: PageHeaderProps) {
  return (
    <Stack direction="horizontal" justify="space-between" align="center" wrap>
      <div>
        <h1 className="pms-page__title">{title}</h1>
        {subtitle && <p className="pms-page__subtitle">{subtitle}</p>}
      </div>
      {rightContent && <div>{rightContent}</div>}
    </Stack>
  );
}
