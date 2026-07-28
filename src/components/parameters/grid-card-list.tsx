"use client";

import { useState } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import type { GridCard, GridCardListData } from "@/lib/parameters/types";
import { PromptDialog } from "./prompt-dialog";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";

export function GridCardList<T>({
  data,
  onSave,
  emptyData,
  renderEditor,
}: {
  data: GridCardListData<T>;
  onSave: (data: GridCardListData<T>) => Promise<void>;
  emptyData: T;
  renderEditor: (data: T, onSave: (next: T) => Promise<void>) => React.ReactNode;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const cards = [...data.cards].sort((a, b) => a.serialNo - b.serialNo);
  const openCard = cards.find((c) => c.id === openId);

  function addCard(name: string) {
    const nextSerial = Math.max(0, ...data.cards.map((c) => c.serialNo)) + 1;
    const newCard: GridCard<T> = {
      id: crypto.randomUUID(),
      serialNo: nextSerial,
      name,
      isActive: data.cards.length === 0,
      data: emptyData,
    };
    onSave({ cards: [...data.cards, newCard] }).then(() => toast.success("Grid added"));
  }

  function removeCard(id: string) {
    const wasActive = data.cards.find((c) => c.id === id)?.isActive;
    let next = data.cards.filter((c) => c.id !== id);
    if (wasActive && next.length > 0) {
      next = next.map((c, i) => (i === 0 ? { ...c, isActive: true } : c));
    }
    onSave({ cards: next }).then(() => toast.success("Grid deleted"));
  }

  function setActive(id: string) {
    const next = data.cards.map((c) => ({ ...c, isActive: c.id === id }));
    onSave({ cards: next }).then(() => toast.success("Active grid updated"));
  }

  function saveCardData(id: string, nextData: T) {
    const next = data.cards.map((c) => (c.id === id ? { ...c, data: nextData } : c));
    return onSave({ cards: next });
  }

  if (openCard) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setOpenId(null)}>
          <ArrowLeft /> Back to grids
        </Button>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">
            #{openCard.serialNo} — {openCard.name}
          </h2>
          {openCard.isActive && <Badge>Active</Badge>}
        </div>
        {renderEditor(openCard.data, (next) => saveCardData(openCard.id, next))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {cards.length === 0 ? (
        <p className="text-sm text-muted-foreground">No grids yet. Add one to get started.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card) => (
            <Card
              key={card.id}
              className={card.isActive ? "border-primary shadow-sm" : undefined}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  <span className="truncate">
                    <span className="text-muted-foreground font-normal">#{card.serialNo}</span>{" "}
                    {card.name}
                  </span>
                  {card.isActive && <Badge>Active</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button variant="outline" size="sm" onClick={() => setOpenId(card.id)}>
                  Open
                </Button>
              </CardContent>
              <CardFooter className="flex items-center justify-between">
                {!card.isActive && (
                  <Button variant="ghost" size="sm" onClick={() => setActive(card.id)}>
                    Set active
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 ml-auto"
                  onClick={() => setDeleteId(card.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
        <Plus /> Add grid
      </Button>

      <PromptDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add grid"
        label="e.g. Grid 2"
        onSubmit={addCard}
      />
      <ConfirmDeleteDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete this grid?"
        description="This removes the grid and all its values. This cannot be undone."
        onConfirm={() => deleteId && removeCard(deleteId)}
      />
    </div>
  );
}
