import type { ReactNode } from "react";
import { Card, Stack } from "@ui/components";

export interface ModulePlaceholderProps {
  /** Module title shown as the page heading. */
  title: string;
  /** Short description of what the module will contain. */
  description?: ReactNode;
}

/**
 * Placeholder content for module routes.
 *
 * Task 2.2 establishes routing and the layout shell only; feature content is
 * built in later, module-specific tasks. This component renders a consistent
 * empty module screen so navigation between modules is functional and verifiable.
 */
export function ModulePlaceholder({
  title,
  description,
}: ModulePlaceholderProps) {
  return (
    <Stack gap="lg">
      <div>
        <h1 className="pms-page__title">{title}</h1>
      </div>
      <Card>
        <Stack gap="sm">
          <p className="pms-page__lead">
            {description ?? `${title} module.`}
          </p>
          <p className="pms-page__hint">
            This screen is a placeholder. Module content is implemented in a
            later task.
          </p>
        </Stack>
      </Card>
    </Stack>
  );
}
