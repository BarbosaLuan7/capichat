import * as React from "react";
import { Button, ButtonProps } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface IconButtonProps extends ButtonProps {
  /** Texto obrigatório do tooltip */
  tooltip: string;
  /** Posição do tooltip (padrão: top) */
  tooltipSide?: "top" | "right" | "bottom" | "left";
}

/**
 * Botão de ícone com tooltip obrigatório para garantir acessibilidade
 */
const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ tooltip, tooltipSide = "top", children, ...props }, ref) => {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button ref={ref} {...props}>
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent side={tooltipSide}>
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    );
  }
);

IconButton.displayName = "IconButton";

export { IconButton };
