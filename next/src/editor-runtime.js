/* IM timeline, interactions, and composer wired to the host note. */
function ImEditor() {
  imUseControlTouchProtection();
  const phoneInput = () => window.matchMedia("(pointer:coarse) and (hover:none)").matches;
  const menuRef = dt.useRef(null);
  const menuPress = dt.useRef(false);
  const touchStart = dt.useRef(null);
  const migrationAttempts = dt.useRef(null);
  const [pinView, setPinView] = dt.useState(false);
  const [saveError, setSaveError] = dt.useState("");
  const [sessionRevision, refreshSessions] = dt.useState(0);
  const sessionRef = dt.useRef(null);
  const contextReceiver = dt.useRef(null);
  if (!sessionRef.current) sessionRef.current = new ImNoteSessions(() => refreshSessions(v => v + 1));
  const sessions = sessionRef.current;
  const [formatError, setFormatError] = dt.useState(null);
  const [emojiDeleteMode, setEmojiDeleteMode] = dt.useState(false);
  const [emojiEditMode, setEmojiEditMode] = dt.useState(false);
  const [emojiEdit, setEmojiEdit] = dt.useState(null);
  const [searchOpen, setSearchOpen] = dt.useState(false);
  const [moreOpen, setMoreOpen] = dt.useState(false);
  const [dateOpen, setDateOpen] = dt.useState(false);
  dt.useEffect(() => {
    if (!searchOpen) setDateOpen(false)
  }, [searchOpen]);
  dt.useEffect(() => {
    const close = () => {
      setSearchOpen(false), setMoreOpen(false), setAppearanceOpen(false), setArrangingTags(false)
    };
    const key = e => {
      if (e.defaultPrevented) return;
      if (e.key === "Escape") {
        close();
        setMessageMenu(null);
        rememberSelection(new Set)
      }
    };
    const outside = e => {
      if (!e.target.closest(".message-tools")) close()
    };
    window.addEventListener("keydown", key);
    window.addEventListener("pointerdown", outside);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("pointerdown", outside)
    }
  }, []);
  const [noteMessages, setNoteMessages] = dt.useState([]);
  const [editorSettings, setEditorSettings] = dt.useState(_a);
  const [draftText, setDraftText] = dt.useState("");
  const [reply, setReply] = dt.useState(null);
  const replyCache = dt.useRef(new Map);
  const [noteReady, setNoteReady] = dt.useState(false);
  const [searchQuery, setSearchQuery] = dt.useState("");
  const [tagFilter, setTagFilter] = dt.useState(null);
  const [messageMenu, setMessageMenu] = dt.useState(null);
  const [editingId, setEditingId] = dt.useState(null);
  const [editingText, setEditingText] = dt.useState("");
  const [selectedIds, setSelection] = dt.useState(new Set);
  const rememberSelection = update => {
    const uuid = noteRef.current?.uuid;
    setSelection(previous => {
      const next = typeof update === "function" ? update(previous) : update;
      if (uuid) imRememberSelection(uuid, next, composerRef.current);
      return next
    })
  };
  const [appearanceOpen, setAppearanceOpen] = dt.useState(false);
  const [arrangingTags, setArrangingTags] = dt.useState(false);
  const [newEmoji, setNewEmoji] = dt.useState("");
  const [loadingTimedOut, setLoadingTimedOut] = dt.useState(false);
  const noteRef = dt.useRef(null);
  const draftCache = dt.useRef(new Map);
  const sending = dt.useRef(new Map);
  const inputRef = dt.useRef(null);
  const messageListRef = dt.useRef(null);
  const composerRef = dt.useRef(null);
  const holdTimer = dt.useRef(null);
  const suppressMessageClick = dt.useRef(false);
  const saveTracked = (note, options) => {
    const uuid = note.uuid;
    const draft = imFormat.readDraft(note);
    const savedReply = imFormat.readReply(note);
    const sendingId = sending.current.get(uuid)?.id;
    const sentIncluded = sendingId && readNoteMessages(note).some(message => message.id === sendingId);
    const promise = sessions.persist(note, options);
    promise.then(() => {
      if (sessions.paused(uuid)) return;
      if (draftCache.current.get(uuid) === draft) draftCache.current.delete(uuid);
      if (JSON.stringify(replyCache.current.get(uuid)) === JSON.stringify(savedReply)) replyCache.current
        .delete(uuid);
      const sent = sending.current.get(uuid);
      if (sent && sent.id === sendingId && sentIncluded) {
        sending.current.delete(uuid);
        if (!sent.newerDraft && draftCache.current.get(uuid) === sent.text) draftCache.current.delete(uuid);
        if (noteRef.current?.uuid === uuid) {
          setDraftText(value => !sent.newerDraft && value === sent.text ? draft : value);
          setReply(value => JSON.stringify(value) === JSON.stringify(sent.reply) ? savedReply : value)
        }
      }
    }, () => {});
    return promise
  };
  const resizeComposer = () => imResizeVisualComposer(inputRef.current);
  const composerHasText = text => inputRef.current?.imRich?.hasText(text) ?? imMarkdown.hasText(text);
  const workingDraft = note => {
    const cached = draftCache.current.get(note.uuid);
    const sent = sending.current.get(note.uuid);
    return cached !== undefined && !(sent && !sent.newerDraft && sent.text === cached && readNoteMessages(note)
      .some(message => message.id === sent.id)) ? cached : imFormat.readDraft(note)
  };
  const titleEdit = sessions.titleFor(noteRef.current?.uuid);
  dt.useEffect(() => {
    sessions.notify = () => refreshSessions(v => v + 1);
    const h = R => {
      var B;
      if (R.isMetadataUpdate === true) {
        sessions.metadata(R);
        return
      }
      R = sessions.receive(R);
      if (!R) return;
      if (noteRef.current?.uuid !== R.uuid) {
        migrationAttempts.current = null;
        setSaveError("");
      }
      R.content && (((B = noteRef.current) == null ? void 0 : B.uuid) !== R.uuid && (setDraftText(draftCache
          .current.get(R.uuid) ?? imFormat.readDraft(R)), setPinView(false), setSearchQuery(""),
        setTagFilter(null), setDateOpen(false), setSelection(imRestoreSelection(R.uuid, readNoteMessages(
          R), composerRef.current)), setEditingId(sessions.editFor(R.uuid)?.id || null), setEditingText(
          sessions.editFor(R.uuid)?.text || ""), setAppearanceOpen(false), setArrangingTags(false),
        setSearchOpen(false), setMoreOpen(false)), noteRef.current = R, setDraftText(draftCache.current
        .get(R.uuid) ?? imFormat.readDraft(R)), setReply(replyCache.current.has(R.uuid) ? replyCache
        .current.get(R.uuid) : imFormat.readReply(R)), (() => {
        const document = imFormat.inspect(R.content.text);
        setFormatError(document.kind === "damaged" ? {
          ...document,
          proposal: imFormat.recover(R.content.text)
        } : null);
        const messages = readNoteMessages(R);
        const settings = readEditorSettings(R);
        setSelection(previous => {
          if (!previous.size) return previous;
          const ids = new Set(messages.map(message => message.id));
          const kept = new Set([...previous].filter(id => ids.has(id)));
          if (kept.size === previous.size) return previous;
          imRememberSelection(R.uuid, kept, composerRef.current);
          return kept
        });
        setNoteMessages(messages), setEditorSettings(settings);
        if (document.kind !== "damaged" && (!imFormat.isCurrent(R, messages, settings) || (draftCache
              .current.has(R.uuid) && workingDraft(R) !== imFormat.readDraft(R)) || replyCache.current
            .has(R.uuid))) {
          const signature = {
            text: R.content.text,
            settings: JSON.stringify(settings),
            draft: workingDraft(R),
            reply: JSON.stringify(replyCache.current.get(R.uuid))
          };
          const previous = migrationAttempts.current;
          if (!previous || Object.keys(signature).some(key => previous[key] !== signature[key])) {
            migrationAttempts.current = signature;
            if (document.kind === "portable" || imFormat.serialize(messages) === (R.content.text ??
              "")) {
              imFormat.write(R, messages, settings, workingDraft(R), replyCache.current.has(R.uuid) ?
                replyCache.current.get(R.uuid) : imFormat.readReply(R));
              saveTracked(R)
            } else setSaveError(
              "Note formatting could not be recovered. Your original text has been left unchanged.")
          }
        }
      })(), setNoteReady(imFormat.inspect(R.content.text).kind !== "damaged"), setLoadingTimedOut(false))
    };
    contextReceiver.current = h;
    return gf.add(h), yf && h(yf), () => {
      gf.delete(h);
      contextReceiver.current = null;
      sessions.notify = () => {};
      noteRef.current = null
    }
  }, []), dt.useEffect(() => {
    if (noteReady) return;
    const h = window.setTimeout(() => setLoadingTimedOut(true), 3500);
    return () => window.clearTimeout(h)
  }, [noteReady]), dt.useEffect(() => {
    const h = () => setMessageMenu(null);
    return window.addEventListener("pointerdown", h), () => window.removeEventListener("pointerdown", h)
  }, []);
  const saveMessages = (h, R = editorSettings, draft, pendingReply) => {
    const B = noteRef.current;
    if (!(B != null && B.content) || imFormat.inspect(B.content.text).kind === "damaged") return;
    if (!sessions.canWrite(B)) return sessions.persist(B);
    R = imPinSettings(R, h);
    imFormat.write(B, h, R, draft === undefined ? imFormat.readDraft(B) : draft, pendingReply === undefined ?
      imFormat.readReply(B) : pendingReply), setNoteMessages(readNoteMessages(B)), setEditorSettings(
      readEditorSettings(B));
    return saveTracked(B)
  };
  const changeSettings = h => saveMessages(noteMessages, {
    ...editorSettings,
    ...h
  });
  const focusComposer = () => requestAnimationFrame(() => {
    var h;
    return (h = inputRef.current) == null ? void 0 : h.focus()
  });
  const persistDraft = value => {
    const note = noteRef.current;
    if (!note || note.deleted || imFormat.inspect(note.content?.text).kind === 'damaged') return;
    imFormat.write(note, readNoteMessages(note), imFormat.readSettings(note), value);
    if (sessions.paused(note.uuid)) {
      sessions.holdDraft(note);
      return Promise.resolve();
    }
    return saveTracked(note, {
      draft: true
    })
  };
  const submitComposer = async () => {
    if (selectedIds.size) return;
    if (titleEdit) {
      saveTitle();
      return
    }
    if (editingId) {
      saveMessageEdit();
      return
    }
    const note = noteRef.current;
    const text = draftText;
    if (!note || !sessions.canWrite(note) || !composerHasText(text) || sending.current.has(note.uuid)) return;
    const sentReply = imFormat.readReply(note);
    sending.current.set(note.uuid, {
      text,
      id: null,
      reply: sentReply
    });
    try {
      if (noteRef.current?.uuid !== note.uuid) {
        sending.current.delete(note.uuid);
        return
      }
      const currentDraft = imFormat.readDraft(note);
      const message = {
        id: Sf(),
        text,
        createdAt: new Date().toISOString(),
        reactions: tagFilter && tagFilter !== imUntagged ? [tagFilter] : [],
        ...(sentReply ? {
          replyTo: sentReply
        } : {})
      };
      sending.current.set(note.uuid, {
        text,
        id: message.id,
        reply: sentReply
      });
      if (currentDraft === text) draftCache.current.set(note.uuid, text);
      const saved = saveMessages([...readNoteMessages(note), message], readEditorSettings(note),
        currentDraft === text ? '' : currentDraft, JSON.stringify(imFormat.readReply(note)) === JSON
        .stringify(sentReply) ? null : imFormat.readReply(note));
      if (!saved) throw new Error('Saving paused');
      await saved;
      if (noteRef.current?.uuid === note.uuid) {
        requestAnimationFrame(() => {
          resizeComposer();
          inputRef.current?.focus({
            preventScroll: true
          })
        })
      }
    } catch {
      if (!sending.current.get(note.uuid)?.id) sending.current.delete(note.uuid)
    }
  };
  const updateMessage = (h, R, B = editorSettings) => saveMessages(noteMessages.map(ot => ot.id === h ? R(ot) :
    ot), B);
  dt.useEffect(() => {
    if (!arrangingTags) {
      setEmojiDeleteMode(false);
      setEmojiEditMode(false);
      setEmojiEdit(null)
    }
  }, [arrangingTags]);
  const transfer = imUseTransfer({
    noteRef: noteRef,
    messages: noteMessages,
    settings: editorSettings,
    save: saveMessages,
    clearFilters: () => {
      setSearchQuery(""), setTagFilter(null), setDateOpen(false)
    },
    selected: selectedIds
  });
  const timer = imUseSilentTimer();
  const statusClear = imUseStatusClear({
    noteRef: noteRef,
    messages: noteMessages,
    save: saveMessages,
    notify: transfer.notify
  });
  const merge = imUseMessageMerge({
    noteRef: noteRef,
    selected: selectedIds,
    save: saveMessages,
    select: rememberSelection,
    notify: transfer.notify
  });
  const replyHighlight = imUseReplyHighlight(noteRef.current?.uuid);
  const changeReply = value => {
    const note = noteRef.current;
    if (!note) return;
    setReply(value);
    replyCache.current.set(note.uuid, value);
    saveMessages(readNoteMessages(note), readEditorSettings(note), undefined, value)?.catch(() => {});
  };
  const startReply = message => {
    if (sessions.titleFor(noteRef.current?.uuid)) {
      transfer.notify("Finish or cancel the current title entry first.");
      setMessageMenu(null);
      return;
    }
    setPinView(false);
    cancelEdit();
    changeReply(imReplySnapshot(message, noteRef.current.uuid));
    setMessageMenu(null);
    focusComposer();
  };
  const showReply = value => imShowReply({
    reply: value,
    messages: noteMessages,
    noteId: noteRef.current?.uuid,
    scroller: messageListRef,
    composer: composerRef,
    clearFilters: () => {
      setSearchQuery("");
      setTagFilter(null);
      setDateOpen(false)
    },
    notice: transfer.notify,
    highlight: replyHighlight.show
  });
  const jumpToDate = value => {
    const target = imDateTarget(noteMessages, value);
    if (!target) return false;
    const noteId = noteRef.current?.uuid;
    setSearchQuery("");
    setTagFilter(null);
    setPinView(false);
    setSearchOpen(false);
    setDateOpen(false);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (noteRef.current?.uuid !== noteId) return;
      showReply(imReplySnapshot(target.message, noteId));
      const notice = imDateJumpNotice(target);
      if (notice) transfer.notify(notice)
    }));
    return true;
  };
  const restoreRecords = () => {
    const note = noteRef.current;
    if (!note || note.content.text !== formatError?.text) return;
    try {
      const restored = imFormat.restore(note);
      noteRef.current = restored;
      setNoteMessages(readNoteMessages(restored));
      setEditorSettings(readEditorSettings(restored));
      setFormatError(null);
      setNoteReady(true);
      saveTracked(restored)
    } catch {
      setSaveError("The records could not be restored. The complete original text has been kept.")
    }
  };
  dt.useEffect(() => {
    const h = R => {
      if (pinView || selectedIds.size || phoneInput() || !noteReady || R.defaultPrevented || R.ctrlKey || R
        .metaKey || R.altKey || R.isComposing) return;
      const B = R.target;
      if (B?.closest?.('button,a,[role="button"],[role="dialog"]')) return;
      if (!(B != null && B.matches('input, textarea, select, [contenteditable="true"]'))) {
        if (R.key === "Enter") {
          R.preventDefault(), submitComposer();
          return
        }
        if (R.key === "Backspace") {
          R.preventDefault(), inputRef.current?.imRich ? inputRef.current.imRich.backspaceAtEnd() :
            setComposerText((titleEdit ? titleEdit.text : editingId ? editingText : draftText).slice(0, -1)),
            requestAnimationFrame(resizeComposer), focusComposer();
          return
        }
        R.key.length === 1 && (R.preventDefault(), inputRef.current?.imRich ? inputRef.current.imRich
          .appendText(R.key) : setComposerText((titleEdit ? titleEdit.text : editingId ? editingText :
            draftText) + R.key), requestAnimationFrame(resizeComposer), focusComposer())
      }
    };
    return window.addEventListener("keydown", h), () => window.removeEventListener("keydown", h)
  }, [noteReady, draftText, noteMessages, editorSettings, editingId, editingText, selectedIds.size, pinView,
    titleEdit?.text, titleEdit?.id
  ]);
  const setComposerText = value => {
    if (titleEdit) {
      sessions.rememberTitle(noteRef.current, titleEdit.id, value)
    } else if (editingId) {
      sessions.rememberEdit(noteRef.current, editingId, value);
      setEditingText(value)
    } else {
      const pending = sending.current.get(noteRef.current?.uuid);
      if (pending) pending.newerDraft = true;
      setDraftText(value);
      if (noteRef.current) {
        draftCache.current.set(noteRef.current.uuid, value);
        persistDraft(value)?.catch(() => {})
      }
    }
  };
  const cancelTitle = () => {
    sessions.cancelTitle(noteRef.current?.uuid);
    requestAnimationFrame(() => {
      resizeComposer();
      inputRef.current?.focus({
        preventScroll: true
      })
    })
  };
  const startTitle = message => {
    if (!sessions.canWrite(noteRef.current)) return;
    const current = sessions.titleFor(noteRef.current.uuid);
    if (current && current.id !== message.id) {
      transfer.notify("Finish or cancel the current title entry first.");
      setMessageMenu(null);
      return;
    }
    if (!current) sessions.rememberTitle(noteRef.current, message.id, imFormat.title(message));
    setPinView(false);
    setMessageMenu(null);
    requestAnimationFrame(() => {
      resizeComposer();
      inputRef.current?.focus({
        preventScroll: true
      })
    })
  };
  const saveTitle = () => {
    const note = noteRef.current;
    const edit = sessions.titleFor(note?.uuid);
    if (!edit || !sessions.canWrite(note)) return;
    const source = readNoteMessages(note).find(m => m.id === edit.id);
    if (!source || imFormat.title(source) !== edit.original && imFormat.title(source) !== edit.submittedText) {
      transfer.notify("This title changed. Your entry is retained; review before saving.");
      return;
    }
    sessions.submitTitle(note.uuid, edit.text);
    saveMessages(readNoteMessages(note).map(m => m.id === edit.id ? imFormat.withTitle(m, edit.text) : m),
      readEditorSettings(note))?.catch(() => {});
  };
  const cancelEdit = () => {
    if (noteRef.current) sessions.cancelEdit(noteRef.current.uuid, editingId);
    setEditingId(null);
    setEditingText("");
    requestAnimationFrame(resizeComposer)
  };
  dt.useEffect(() => {
    if (!editingId) return;
    const edit = sessions.editFor(noteRef.current?.uuid);
    if (edit?.id === editingId) {
      if (edit.text !== editingText) setEditingText(edit.text)
    } else if (!edit) {
      setEditingId(null);
      setEditingText("");
      requestAnimationFrame(() => {
        resizeComposer();
        inputRef.current?.focus({
          preventScroll: true
        })
      })
    }
  }, [sessionRevision, editingId, editingText]);
  dt.useLayoutEffect(() => {
    resizeComposer()
  }, [editingId, editingText, draftText, selectedIds.size, titleEdit?.text, titleEdit?.id]);
  dt.useEffect(() => {
    if (editingId && !noteMessages.some(h => h.id === editingId)) cancelEdit()
  }, [editingId, noteMessages]);
  dt.useEffect(() => {
    if (titleEdit && !noteMessages.some(m => m.id === titleEdit.id)) sessions.cancelTitle(noteRef.current
      ?.uuid)
  }, [titleEdit?.id, noteMessages]);
  const deleteMessage = h => {
    window.confirm("Delete this message?") && (saveMessages(noteMessages.filter(R => R.id !== h)),
      rememberSelection(R => {
        const B = new Set(R);
        return B.delete(h), B
      }), setMessageMenu(null))
  };
  const toggleMessageTag = (h, R) => {
    updateMessage(h, ot => ({
      ...ot,
      reactions: ot.reactions.includes(R) ? ot.reactions.filter(xt => xt !== R) : [...ot.reactions, R]
    })), setMessageMenu(null)
  };
  const addEmoji = () => {
    const h = newEmoji.trim();
    if (!h) return;
    try {
      changeSettings(imEmojiAdd(noteMessages, editorSettings, h));
      setNewEmoji("")
    } catch (error) {
      transfer.notify(error.message)
    }
  };
  const chooseFilter = tag => {
    setTagFilter(tag);
    if (!arrangingTags) {
      setSearchOpen(false);
      setMoreOpen(false);
      setAppearanceOpen(false);
      setArrangingTags(false)
    }
  };
  const finishEmojiEdit = () => {
    if (!emojiEdit || !arrangingTags) return;
    let to;
    try {
      to = imEmojiValue(emojiEdit.to)
    } catch (error) {
      transfer.notify(error.message);
      return;
    }
    if (to !== emojiEdit.from) {
      const result = imEmojiChange(noteMessages, editorSettings, emojiEdit.from, to);
      saveMessages(result.messages, result.settings)?.catch(() => {});
      if (tagFilter === emojiEdit.from) setTagFilter(to)
    }
    setEmojiEdit(null);
    setEmojiEditMode(false)
  };
  const removeEmoji = h => {
    if (!arrangingTags || !emojiDeleteMode || !window.confirm(
        `Do you want to delete this emoji? ${h}\n\nIt will be removed from this note’s menu and every message using it. All messages and their text will be kept.`
        )) return;
    const result = imEmojiChange(noteMessages, editorSettings, h);
    saveMessages(result.messages, result.settings)?.catch(() => {});
    tagFilter === h && setTagFilter(null);
    setEmojiDeleteMode(false)
  };
  const toggleMessageSelection = h => {
    suppressMessageClick.current = false;
    if (!selectedIds.size) imCaptureSelectionHeight(composerRef.current);
    inputRef.current?.blur();
    rememberSelection(R => {
      const B = new Set(R);
      return B.has(h) ? B.delete(h) : B.add(h), B
    }), setMessageMenu(null)
  };
  const saveMessageEdit = () => {
    if (!editingId || !editingText.trim() || !sessions.canWrite(noteRef.current) || !noteMessages.some(h => h
        .id === editingId)) return;
    sessions.submitEdit(noteRef.current.uuid, editingId, editingText);
    const original = noteMessages.find(h => h.id === editingId);
    const changed = imFormat.editMessage(original, editingText);
    const saved = changed === original ? saveTracked(noteRef.current) : updateMessage(editingId, () => changed);
    saved?.catch(() => {})
  };
  const copySelected = () => transfer.copySelected();
  const deleteSelected = () => {
    !selectedIds.size || !window.confirm(
      `Delete ${selectedIds.size} selected message${selectedIds.size===1?"":"s"}?`) || (saveMessages(
      noteMessages.filter(h => !selectedIds.has(h.id))), rememberSelection(new Set))
  };
  const reactionCounts = dt.useMemo(() => {
    const h = new Map;
    for (const R of noteMessages)
      for (const B of R.reactions) h.set(B, (h.get(B) ?? 0) + 1);
    return h
  }, [noteMessages]);
  const orderedUsedTags = dt.useMemo(() => {
    const h = [...reactionCounts.keys()];
    return [...editorSettings.reactionOrder.filter(R => h.includes(R)), ...h.filter(R => !editorSettings
      .reactionOrder.includes(R)).sort()]
  }, [reactionCounts, editorSettings.reactionOrder]);
  const emojiOrder = dt.useMemo(() => imEmojiOrder(noteMessages, editorSettings), [noteMessages, editorSettings
    .reactionOrder, editorSettings.deletedEmojis
  ]);
  const visibleMessages = dt.useMemo(() => {
    const h = pinView ? "" : searchQuery.trim().toLocaleLowerCase();
    return noteMessages.filter(R => (!h || (imMarkdown.message(R).text.toLocaleLowerCase().includes(h) ||
      imFormat.title(R).toLocaleLowerCase().includes(h)) || R.reactions.some(B => B.includes(h))) && (
      pinView || !tagFilter || (tagFilter === imUntagged ? !R.reactions.length : R.reactions.includes(
        tagFilter))) && (!pinView || imPinIds(editorSettings).includes(R.id)))
  }, [noteMessages, searchQuery, tagFilter, pinView, editorSettings]);
  dt.useEffect(() => {
    const find = event => {
      if (event.defaultPrevented || event.isComposing || pinView || selectedIds.size || !noteReady || event
        .target.closest?.('[role="dialog"]')) return;
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() ===
        'f') {
        event.preventDefault();
        setSearchOpen(true);
        setMoreOpen(false);
        setAppearanceOpen(false);
        setArrangingTags(false);
        requestAnimationFrame(() => {
          const input = document.querySelector('[aria-label="Search messages"]');
          input?.focus();
          input?.select()
        })
      }
    };
    window.addEventListener('keydown', find);
    return () => window.removeEventListener('keydown', find)
  }, [selectedIds.size, noteReady, pinView]);
  dt.useEffect(() => {
    if (!pinView) return;
    const key = event => {
      if (event.key === 'Escape' && !selectedIds.size) setPinView(false)
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key)
  }, [pinView, selectedIds.size]);
  const days = dt.useMemo(() => imMessagesByDay(visibleMessages), [visibleMessages]);
  const selectDay = day => {
    if (!selectedIds.size) imCaptureSelectionHeight(composerRef.current);
    inputRef.current?.blur();
    const ids = days.get(day) || [];
    rememberSelection(previous => {
      const next = new Set(previous);
      const all = ids.every(id => next.has(id));
      for (const id of ids) all ? next.delete(id) : next.add(id);
      return next
    });
  };
  const selectedPinNote = noteRef.current;
  const batchPinSelected = () => {
    if (!selectedPinNote || noteRef.current !== selectedPinNote || !sessions.canWrite(selectedPinNote)) return;
    const messages = readNoteMessages(selectedPinNote);
    const settings = readEditorSettings(selectedPinNote);
    const next = imToggleSelectedPins(messages, settings, selectedIds);
    if (next !== settings) saveMessages(messages, next)?.catch(() => {});
  };
  const rowRevision = dt.useMemo(() => ({}), [selectedIds, replyHighlight.id, messageMenu?.messageId, editingId,
    pinView, editorSettings
  ]);
  const viewport = imUseMessageViewport({
    scroller: messageListRef,
    composer: composerRef,
    noteId: noteRef.current?.uuid,
    messages: visibleMessages,
    viewKey: JSON.stringify([searchQuery, tagFilter, pinView])
  });
  const pinnedMessages = imPinIds(editorSettings).map(id => noteMessages.find(message => message.id === id))
    .filter(Boolean);
  const unpinAll = () => {
    if (window.confirm(`Unpin all ${pinnedMessages.length} messages? The messages will stay in this note.`)) {
      const next = {
        ...editorSettings
      };
      delete next.pinnedMessageIds;
      saveMessages(noteMessages, next);
      setPinView(false)
    }
  };
  const showPin = message => {
    const snapshot = imReplySnapshot(message, noteRef.current.uuid);
    if (pinView) {
      setPinView(false);
      setSearchQuery("");
      setTagFilter(null);
      setDateOpen(false);
      requestAnimationFrame(() => requestAnimationFrame(() => showReply(snapshot)))
    } else showReply(snapshot)
  };
  dt.useEffect(() => {
    if (pinView && !pinnedMessages.length) setPinView(false)
  }, [pinView, pinnedMessages.length]);
  const moveEmoji = (h, R) => {
    const next = imEmojiMove(noteMessages, editorSettings, h, R);
    if (next !== editorSettings) changeSettings(next)
  };
  const editorStyle = {
    "--scale": editorSettings.scale,
    ...imParagraphSpacing.style(editorSettings)
  };
  const openMessageMenu = (h, R, B, touch = false, element = null) => {
    if (selectedIds.size) return;
    menuPress.current = false;
    setMessageMenu({
      messageId: B,
      x: h,
      y: R,
      point: {
        x: h,
        y: R
      },
      touch,
      element
    })
  };
  const handleMessageContextMenu = (h, R) => {
    if (h.target.closest("input,textarea,select")) return;
    h.preventDefault();
    if (selectedIds.size) return;
    const type = h.nativeEvent.pointerType;
    if (type === "touch" || touchStart.current || (phoneInput() && type !== "mouse")) return;
    openMessageMenu(h.clientX, h.clientY, R, false, h.currentTarget)
  };
  const cancelMessageHold = () => {
    holdTimer.current !== null && window.clearTimeout(holdTimer.current), holdTimer.current = null, touchStart
      .current = null
  };
  const moveTouch = h => {
    const start = touchStart.current;
    if (start && Math.hypot(h.clientX - start.x, h.clientY - start.y) > 10) cancelMessageHold()
  };
  const finishTouch = h => {
    const gesture = touchStart.current;
    if (gesture && gesture.ready && gesture.pointerId === h.pointerId && Math.hypot(h.clientX - gesture.x, h
        .clientY - gesture.y) <= 10 && Math.abs((messageListRef.current?.scrollTop ?? 0) - gesture.top) <= 2) {
      const {
        x,
        y,
        messageId,
        element
      } = gesture;
      cancelMessageHold();
      suppressMessageClick.current = true;
      openMessageMenu(x, y, messageId, true, element)
    } else cancelMessageHold()
  };
  const startHold = (h, R) => {
    if (selectedIds.size || h.pointerType !== "touch" || h.isPrimary === false || editingId === R || h.target
      .closest("button,input,textarea,select")) return;
    cancelMessageHold();
    const gesture = {
      x: h.clientX,
      y: h.clientY,
      pointerId: h.pointerId,
      messageId: R,
      element: h.currentTarget,
      top: messageListRef.current?.scrollTop,
      ready: false
    };
    touchStart.current = gesture;
    holdTimer.current = window.setTimeout(() => {
      if (touchStart.current !== gesture) return;
      window.getSelection()?.removeAllRanges();
      gesture.ready = true;
      holdTimer.current = null
    }, 520)
  };
  dt.useEffect(() => {
    const list = messageListRef.current;
    if (!list) return;
    const cancelHold = () => {
      if (touchStart.current) cancelMessageHold()
    };
    list.addEventListener("scroll", cancelHold, {
      passive: true
    });
    return () => {
      list.removeEventListener("scroll", cancelHold);
      cancelMessageHold()
    }
  }, [noteRef.current?.uuid]);
  dt.useLayoutEffect(() => {
    if (!messageMenu || !menuRef.current) return;
    const place = () => {
      const menu = menuRef.current;
      if (!menu) return;
      const viewport = window.visualViewport;
      const rect = menu.getBoundingClientRect();
      const anchor = messageMenu.element?.getBoundingClientRect() || {
        top: messageMenu.point.y,
        bottom: messageMenu.point.y,
        right: messageMenu.point.x
      };
      const position = imMenuPosition({
        anchor,
        point: messageMenu.point,
        width: rect.width,
        height: menu.scrollHeight + menu.offsetHeight - menu.clientHeight,
        viewport: {
          left: viewport?.offsetLeft || 0,
          top: viewport?.offsetTop || 0,
          width: viewport?.width || window.innerWidth,
          height: viewport?.height || window.innerHeight
        },
        touch: messageMenu.touch
      });
      if (Math.abs(position.x - messageMenu.x) > .5 || Math.abs(position.y - messageMenu.y) > .5 || position
        .maxHeight !== messageMenu.maxHeight || position.maxWidth !== messageMenu.maxWidth) setMessageMenu(
        current => current?.messageId === messageMenu.messageId ? {
          ...current,
          ...position
        } : current)
    };
    place();
    const viewport = window.visualViewport;
    const scroller = messageListRef.current;
    window.addEventListener("resize", place);
    viewport?.addEventListener("resize", place);
    viewport?.addEventListener("scroll", place);
    scroller?.addEventListener("scroll", place);
    return () => {
      window.removeEventListener("resize", place);
      viewport?.removeEventListener("resize", place);
      viewport?.removeEventListener("scroll", place);
      scroller?.removeEventListener("scroll", place)
    }
  }, [messageMenu]);
  dt.useEffect(() => {
    if (selectedIds.size) {
      cancelMessageHold();
      setMessageMenu(null);
      suppressMessageClick.current = false
    }
  }, [selectedIds.size]);
  return x.jsxs("main", {
    className: `editor-shell bubble-${editorSettings.bubbleTheme} background-${editorSettings.backgroundTheme}${editorSettings.wallpaper?` chat-wallpaper artwork-${imVisibleArtwork(editorSettings.artwork)}`:""}`,
    style: editorStyle,
    children: [x.jsxs("header", {
      className: "message-tools",
      children: [x.jsx(ImSelectionPreferenceNotice, {}), timer.error && x.jsxs("div", {
        className: "save-notice",
        role: "alert",
        children: [timer.error, x.jsx("button", {
          type: "button",
          onClick: imSaveSilentTimer,
          children: "Retry timer saving"
        })]
      }), saveError && x.jsxs("div", {
        className: "save-notice",
        role: "alert",
        children: [saveError]
      }), x.jsx(ImNoteSessionNotice, {
        sessions,
        note: noteRef.current,
        retry: () => saveTracked(noteRef.current)?.catch(() => {}),
        resolve: choice => {
          const uuid = noteRef.current?.uuid;
          const note = sessions.resolve(uuid, choice);
          if (!note) return;
          if (choice === "remote") {
            draftCache.current.delete(uuid);
            replyCache.current.delete(uuid);
            sending.current.delete(uuid);
            setEditingId(null);
            setEditingText("");
            migrationAttempts.current = null;
            contextReceiver.current?.(note)
          } else {
            setNoteMessages(readNoteMessages(note));
            setEditorSettings(readEditorSettings(note));
            saveTracked(note)?.catch(() => {})
          }
        }
      }), pinView && !selectedIds.size && x.jsx(ImPinnedHeader, {
        count: pinnedMessages.length,
        back: () => setPinView(false),
        unpinAll
      }), !pinView && !selectedIds.size && x.jsxs("div", {
        className: "top-row ui-toolbar",
        children: [!pinView && !selectedIds.size && pinnedMessages.length > 0 && x.jsx(
          ImPinnedPreview, {
            key: noteRef.current?.uuid,
            messages: pinnedMessages,
            show: showPin,
            openList: () => {
              setPinView(true);
              setSearchOpen(false);
              setMoreOpen(false);
              inputRef.current?.blur();
              requestAnimationFrame(() => {
                if (messageListRef.current) messageListRef.current.scrollTop =
                  messageListRef.current.scrollHeight
              })
            }
          }), !(searchQuery || tagFilter) && x.jsx("button", {
          type: "button",
          className: "toolbar-button ui-toolbar-button",
          "aria-label": "Search and tags",
          "aria-expanded": searchOpen,
          "aria-controls": "search-tags-panel",
          onClick: () => {
            setSearchOpen(!searchOpen), setMoreOpen(false), setAppearanceOpen(false),
              setArrangingTags(false);
            if (!searchOpen) requestAnimationFrame(() => document.querySelector(
              '[aria-label="Search messages"]')?.focus())
          },
          children: [x.jsx(ImToolbarIcon, {
            name: 'searchTags'
          })]
        }), (searchQuery || tagFilter) && x.jsx(ImFilterIndicator, {
          tag: tagFilter,
          open: searchOpen,
          change: () => {
            setSearchOpen(!searchOpen);
            setMoreOpen(false);
            setAppearanceOpen(false);
            setArrangingTags(false);
            if (!searchOpen) requestAnimationFrame(() => document.querySelector(
              '[aria-label="Search messages"]')?.focus())
          },
          clear: () => {
            setSearchQuery("");
            setTagFilter(null);
            setDateOpen(false);
            setSearchOpen(false);
            setMoreOpen(false);
            setAppearanceOpen(false);
            setArrangingTags(false)
          }
        }), !(searchQuery || tagFilter) && x.jsx("button", {
          type: "button",
          className: "toolbar-button more-button ui-toolbar-button ui-toolbar-more",
          "aria-label": "More options",
          "aria-expanded": moreOpen,
          "aria-controls": "more-options-panel",
          onClick: () => {
            setMoreOpen(!moreOpen), setSearchOpen(false), setAppearanceOpen(false),
              setArrangingTags(false)
          },
          children: x.jsx(ImToolbarIcon, {
            name: 'more'
          })
        })]
      }), !pinView && !selectedIds.size && moreOpen && x.jsxs("div", {
        id: "more-options-panel",
        className: "more-options",
        "aria-label": "More options",
        children: [x.jsx("button", {
          type: "button",
          "aria-expanded": appearanceOpen,
          onClick: () => {
            setAppearanceOpen(!appearanceOpen), setArrangingTags(false)
          },
          children: "Appearance"
        }), x.jsx("button", {
          type: "button",
          "aria-expanded": arrangingTags,
          onClick: () => {
            setArrangingTags(!arrangingTags), setAppearanceOpen(false)
          },
          children: "Arrange tags"
        }), x.jsx("button", {
          type: "button",
          disabled: !noteReady,
          onClick: () => {
            setMoreOpen(false), setAppearanceOpen(false), setArrangingTags(false), transfer
              .openImport()
          },
          children: "Import from clipboard"
        }), x.jsx("button", {
          type: "button",
          className: "danger",
          onClick: () => {
            setMoreOpen(false);
            setAppearanceOpen(false);
            setArrangingTags(false);
            transfer.openClearClipboard()
          },
          children: "Clear clipboard"
        }), x.jsx("button", {
          type: "button",
          disabled: !noteReady || !noteMessages.length,
          onClick: () => {
            setMoreOpen(false);
            statusClear.open()
          },
          children: "Clear message statuses…"
        }), x.jsx("button", {
          type: "button",
          onClick: () => {
            setMoreOpen(false);
            timer.show()
          },
          children: "Timer"
        })]
      }), !pinView && !selectedIds.size && appearanceOpen && x.jsxs("section", {
        className: "appearance",
        "aria-label": "Appearance settings",
        children: [x.jsxs("label", {
          children: ["Message bubbles", x.jsxs("select", {
            value: editorSettings.bubbleTheme,
            onChange: h => changeSettings({
              bubbleTheme: h.target.value
            }),
            children: [x.jsx("option", {
              value: "spring",
              children: "Spring green"
            }), x.jsx("option", {
              value: "sky",
              children: "Sky blue"
            }), x.jsx("option", {
              value: "mint",
              children: "Mint green"
            }), x.jsx("option", {
              value: "lime",
              children: "Fresh lime"
            }), x.jsx("option", {
              value: "lavender",
              children: "Lavender"
            }), x.jsx("option", {
              value: "rose",
              children: "Rose"
            }), x.jsx("option", {
              value: "amber",
              children: "Amber"
            }), x.jsx("option", {
              value: "forest",
              children: "Forest green"
            }), x.jsx("option", {
              value: "midnight",
              children: "Midnight blue"
            }), x.jsx("option", {
              value: "cobalt",
              children: "Cobalt blue"
            }), x.jsx("option", {
              value: "royal",
              children: "Royal blue"
            }), x.jsx("option", {
              value: "iris",
              children: "Iris blue"
            })]
          })]
        }), x.jsxs("label", {
          children: ["Background & input", x.jsxs("select", {
            value: editorSettings.backgroundTheme,
            onChange: h => changeSettings({
              backgroundTheme: h.target.value
            }),
            children: [x.jsx("option", {
              value: "cloud",
              children: "Cloud"
            }), x.jsx("option", {
              value: "pearl",
              children: "Neutral light gray"
            }), x.jsx("option", {
              value: "mist",
              children: "Cool mist"
            }), x.jsx("option", {
              value: "seafoam",
              children: "Seafoam"
            }), x.jsx("option", {
              value: "sand",
              children: "Warm sand"
            }), x.jsx("option", {
              value: "blush",
              children: "Soft blush"
            }), x.jsx("option", {
              value: "lilac",
              children: "Soft lilac"
            })]
          })]
        }), x.jsxs("label", {
          className: "wallpaper-toggle",
          children: [x.jsx(ImPrivateInput, {
            type: "checkbox",
            checked: editorSettings.wallpaper,
            onChange: h => changeSettings({
              wallpaper: h.target.checked
            })
          }), " Background artwork"]
        }), editorSettings.wallpaper && x.jsxs("label", {
          children: ["Artwork", x.jsxs("select", {
            "aria-label": "Artwork",
            value: imVisibleArtwork(editorSettings.artwork),
            onChange: h => changeSettings({
              artwork: h.target.value
            }),
            children: [x.jsx("option", {
              value: "classic",
              children: "Classic · Everyday objects"
            }), x.jsx("option", {
              value: "garden",
              children: "Engraved garden"
            })]
          })]
        }), x.jsxs("label", {
          children: ["Text size", x.jsxs("select", {
            value: editorSettings.scale,
            onChange: h => changeSettings({
              scale: Number(h.target.value)
            }),
            children: [x.jsx("option", {
              value: "1",
              children: "Small"
            }), x.jsx("option", {
              value: "1.12",
              children: "Medium"
            }), x.jsx("option", {
              value: "1.25",
              children: "Large"
            }), x.jsx("option", {
              value: "1.4",
              children: "Extra large"
            })]
          })]
        }), x.jsx(ImParagraphSpacingSetting, {
          settings: editorSettings,
          disabled: !noteReady,
          change: changeSettings
        })]
      }), !pinView && !selectedIds.size && (searchOpen || arrangingTags) && x.jsxs("section", {
        id: "search-tags-panel",
        className: "search-tags-panel",
        "aria-label": "Search and tag filters",
        children: [searchOpen && x.jsx(ImSearchRow, {
          query: searchQuery,
          change: setSearchQuery,
          disabled: !noteReady,
          jumpToDate,
          dateOpen,
          setDateOpen
        }), x.jsxs("div", {
          className: "reaction-filter",
          "aria-label": "Message categories",
          children: [!(arrangingTags && (emojiDeleteMode || emojiEditMode)) && x.jsx(
            "button", {
              className: tagFilter ? "chip" : "chip active",
              onClick: () => chooseFilter(null),
              type: "button",
              children: "All"
            }), imFilterOrder(emojiOrder, editorSettings.untaggedPosition).map(h => h ===
            imUntagged ? (arrangingTags && (emojiDeleteMode || emojiEditMode) ? null : x
              .jsxs("div", {
                className: "tag-control untagged-control",
                children: [x.jsxs("button", {
                  type: "button",
                  className: tagFilter === imUntagged ? "chip active" : "chip",
                  "aria-label": "Untagged",
                  "aria-pressed": tagFilter === imUntagged,
                  onClick: () => chooseFilter(tagFilter === imUntagged ? null :
                    imUntagged),
                  children: [x.jsx(ImUntaggedIcon, {}), " ", noteMessages.filter(
                    message => !message.reactions.length).length]
                }), arrangingTags && !emojiDeleteMode && !emojiEditMode && x.jsxs(
                  "span", {
                    children: [x.jsx("button", {
                      type: "button",
                      "aria-label": "Move Untagged earlier",
                      onClick: () => moveEmoji(h, -1),
                      children: "‹"
                    }), x.jsx("button", {
                      type: "button",
                      "aria-label": "Move Untagged later",
                      onClick: () => moveEmoji(h, 1),
                      children: "›"
                    })]
                  })]
              }, h)) : x.jsxs("div", {
              className: "tag-control",
              children: [x.jsxs("button", {
                className: arrangingTags && emojiDeleteMode ?
                  "chip emoji-delete-choice" : tagFilter === h ? "chip active" :
                  "chip",
                onClick: () => arrangingTags && emojiDeleteMode ? removeEmoji(
                  h) : arrangingTags && emojiEditMode ? setEmojiEdit({
                    from: h,
                    to: h
                  }) : chooseFilter(tagFilter === h ? null : h),
                "aria-label": arrangingTags && emojiDeleteMode ?
                  `Delete ${h} from emoji menu` : arrangingTags &&
                  emojiEditMode ? `Edit ${h}` : void 0,
                "aria-pressed": arrangingTags && (emojiDeleteMode ||
                  emojiEditMode) ? void 0 : tagFilter === h,
                type: "button",
                children: [h, " ", reactionCounts.get(h) || 0]
              }), arrangingTags && !emojiDeleteMode && !emojiEditMode && x.jsxs(
                "span", {
                  children: [x.jsx("button", {
                    "aria-label": `Move ${h} earlier`,
                    onClick: () => moveEmoji(h, -1),
                    children: "‹"
                  }), x.jsx("button", {
                    "aria-label": `Move ${h} later`,
                    onClick: () => moveEmoji(h, 1),
                    children: "›"
                  })]
                })]
            }, h))]
        }), arrangingTags && x.jsx("p", {
          className: "emoji-delete-help",
          role: emojiDeleteMode ? "status" : void 0,
          children: emojiEditMode ?
            "Choose an emoji to replace throughout this note. All message text will be kept." :
            emojiDeleteMode ?
            "Choose an emoji to delete. Confirmation removes its tags from all messages, keeping every message." :
            "Add, edit, delete or arrange emoji tags for this note."
        }), arrangingTags && emojiEdit && x.jsx(ImEmojiReplacement, {
          key: emojiEdit.from,
          from: emojiEdit.from,
          to: emojiEdit.to,
          count: noteMessages.filter(message => message.reactions.includes(emojiEdit.from))
            .length,
          change: value => setEmojiEdit(current => ({
            ...current,
            to: value
          })),
          save: finishEmojiEdit,
          cancel: () => {
            setEmojiEdit(null);
            setEmojiEditMode(false)
          }
        }), arrangingTags && x.jsxs("form", {
          className: "arrange-emoji",
          onSubmit: h => {
            h.preventDefault(), addEmoji()
          },
          children: [x.jsx(ImPrivateInput, {
            value: newEmoji,
            onChange: h => setNewEmoji(h.target.value),
            placeholder: "Add an emoji to the menu",
            "aria-label": "Add an emoji category",
            maxLength: 12,
            disabled: emojiDeleteMode || emojiEditMode
          }), x.jsx("button", {
            type: "submit",
            disabled: emojiDeleteMode || emojiEditMode || !newEmoji.trim(),
            children: "Add emoji"
          }), x.jsx("button", {
            type: "button",
            "aria-pressed": emojiEditMode,
            onClick: () => {
              setEmojiDeleteMode(false);
              setEmojiEdit(null);
              setEmojiEditMode(!emojiEditMode)
            },
            disabled: !noteReady || (!emojiOrder.length && !emojiEditMode),
            children: emojiEditMode ? "Cancel editing emoji" : "Edit emoji"
          }), x.jsx("button", {
            type: "button",
            className: "emoji-delete-toggle",
            "aria-pressed": emojiDeleteMode,
            onClick: () => {
              setEmojiEditMode(false);
              setEmojiEdit(null);
              setEmojiDeleteMode(!emojiDeleteMode)
            },
            disabled: !noteReady || (!emojiOrder.length && !emojiDeleteMode),
            children: emojiDeleteMode ? "Cancel deleting" : "Delete emoji"
          })]
        })]
      }), selectedIds.size > 0 && x.jsx(ImSelectionToolbar, {
        count: selectedIds.size,
        order: emojiOrder,
        messages: noteMessages,
        settings: editorSettings,
        selected: selectedIds,
        pin: batchPinSelected,
        save: saveMessages,
        copy: copySelected,
        exportMessages: transfer.exportSelected,
        remove: deleteSelected,
        more: () => statusClear.open(selectedIds),
        merge: merge.open
      }), x.jsx(ImSilentTimerBadge, {
        timer
      })]
    }), x.jsx("section", {
      ref: messageListRef,
      "aria-label": "Messages",
      className: `messages${pinView?" pinned-messages":""}`,
      role: "log",
      "aria-live": "polite",
      onContextMenuCapture: h => {
        if (selectedIds.size) {
          h.preventDefault();
          h.stopPropagation()
        }
      },
      onPointerDown: h => {
        if (h.pointerType !== "touch" || h.target.closest(
            ".message-wrap,button,input,textarea,select,[contenteditable=true]")) return;
        const active = document.activeElement;
        if (active && active.matches("input,textarea,[contenteditable=true]")) active.blur()
      },
      onClick: h => {
        if (h.target.closest(".message-wrap,button,input,textarea,select,[contenteditable=true]"))
          return;
        if (phoneInput() || h.nativeEvent.pointerType === "touch") {
          inputRef.current?.blur();
          return
        }
        focusComposer()
      },
      children: formatError ? x.jsx(ImRecoveryView, {
        error: formatError,
        restore: restoreRecords
      }) : noteReady ? visibleMessages.length ? x.jsx(ImVirtualMessages, {
        key: noteRef.current?.uuid,
        messages: visibleMessages,
        scroller: messageListRef,
        revision: rowRevision,
        scale: editorSettings.scale,
        paragraphSpacing: imParagraphSpacing.value(editorSettings),
        selecting: selectedIds.size > 0,
        render: (h, R) => {
          const B = visibleMessages[R - 1];
          const ot = !B || messageDayKey(B.createdAt) !== messageDayKey(h.createdAt);
          const xt = selectedIds.has(h.id);
          const Ee = selectedIds.size > 0;
          const noteAtRender = noteRef.current;
          return x.jsxs("div", {
            className: "message-group",
            children: [ot && x.jsx(ImDayDivider, {
              label: messageDayLabel(h.createdAt),
              ids: days.get(messageDayKey(h.createdAt)),
              selected: selectedIds,
              select: () => selectDay(messageDayKey(h.createdAt)),
              continuation: !!B
            }), x.jsxs(ImSelectionRow, {
              id: h.id,
              selecting: Ee,
              toggle: toggleMessageSelection,
              scroller: messageListRef,
              className: `message-row${xt||replyHighlight.id===h.id||messageMenu?.messageId===h.id?" message-emphasized":""}`,
              style: {
                marginTop: imMessageGap(B, h, ot)
              },
              children: [Ee && x.jsx("button", {
                className: `selection-check${xt?" checked":""}`,
                type: "button",
                "aria-label": `${xt?"Unselect":"Select"} message`,
                onClick: Ht => {
                  Ht.stopPropagation(), toggleMessageSelection(h.id)
                },
                children: x.jsx("span", {
                  className: "selection-mark",
                  "aria-hidden": true,
                  children: xt ? "✓" : ""
                })
              }), pinView && !Ee && x.jsx("button", {
                type: "button",
                className: "pin-source-jump",
                "aria-label": "Show pinned message in full note",
                onClick: () => showPin(h),
                children: x.jsx("svg", {
                  width: 22,
                  height: 22,
                  viewBox: "0 0 24 24",
                  fill: "none",
                  stroke: "currentColor",
                  strokeWidth: 2,
                  "aria-hidden": true,
                  children: x.jsx("path", {
                    d: "M4 12h16m-6-6 6 6-6 6"
                  })
                })
              }), x.jsxs("article", {
                "data-message-id": h.id,
                className: `message-wrap${xt?" selected":""}${Ee?" selection-mode":""}${messageMenu?.messageId===h.id?" context-active":""}${editingId===h.id?" editing":""}${replyHighlight.id===h.id?" reply-located":""}`,
                onClick: () => {
                  if (suppressMessageClick.current) {
                    suppressMessageClick.current = false;
                    return
                  }
                  Ee && toggleMessageSelection(h.id)
                },
                onContextMenu: Ht => handleMessageContextMenu(Ht, h.id),
                onPointerDown: Ht => startHold(Ht, h.id),
                onPointerMove: moveTouch,
                onPointerUp: finishTouch,
                onPointerCancel: cancelMessageHold,
                onPointerLeave: cancelMessageHold,
                children: [x.jsxs("div", {
                  className: `message-bubble${h.reactions.length?" has-reactions":" no-reactions"}`,
                  children: [h.forwarding && !h.importedStatusCleared && x
                    .jsx("div", {
                      className: "forwarded-label",
                      children: "↪ Imported"
                    }), h.replyTo && x.jsx(ImBubbleQuote, {
                      reply: h.replyTo,
                      show: showReply,
                      selecting: Ee
                    }), imFormat.title(h) && x.jsx("div", {
                      className: "message-title",
                      children: imFormat.title(h)
                    }), x.jsx(ImMarkdownMessage, {
                      message: h,
                      selecting: Ee,
                      noteId: noteAtRender?.uuid,
                      onCheck: index => {
                        if (noteRef.current !== noteAtRender) return;
                        if (Ee) {
                          toggleMessageSelection(h.id);
                          return
                        }
                        if (sessions.canWrite(noteRef.current))
                          updateMessage(h.id, current => imFormat
                            .editMessage(current, imMarkdown
                              .toggleCheck(current.text, index)))
                          ?.catch(() => {})
                      }
                    }), (h.reactions.length > 0 || h.createdAt || h
                      .edited || h.copied || h.exported || imPinIds(
                        editorSettings).includes(h.id)) && x.jsxs("div", {
                      className: "message-footer",
                      children: [x.jsx("div", {
                        className: "message-reactions",
                        children: h.reactions.map(Ht => x.jsx(
                          "button", {
                            type: "button",
                            onClick: Ze => {
                              Ze.stopPropagation(),
                                setTagFilter(Ht),
                                setSearchOpen(true),
                                setMoreOpen(false),
                                setAppearanceOpen(false),
                                setArrangingTags(false)
                            },
                            "aria-label": `Filter messages by ${Ht}`,
                            children: [x.jsxs("svg", {
                              className: "emoji-tag-body",
                              "aria-hidden": true,
                              focusable: "false",
                              children: [x.jsx("rect", {
                                width: "100%",
                                height: "100%",
                                rx: 6
                              }), x.jsx("rect", {
                                x: "50%",
                                width: "50%",
                                height: "100%"
                              })]
                            }), x.jsx("svg", {
                              className: "emoji-tag-tip",
                              viewBox: "0 0 20 40",
                              "aria-hidden": true,
                              focusable: "false",
                              children: x.jsx("path", {
                                fillRule: "evenodd",
                                clipRule: "evenodd",
                                d: "M0 0H2Q6 0 9 4L18 16Q22 20 18 24L9 36Q6 40 2 40H0ZM13 20a3.5 3.5 0 1 0-7 0a3.5 3.5 0 1 0 7 0Z"
                              })
                            }), x.jsx("span", {
                              className: "emoji-tag-emoji",
                              children: Ht
                            })]
                          }, Ht))
                      }), x.jsxs("div", {
                        className: "message-meta",
                        children: [imPinIds(editorSettings)
                          .includes(h.id) && x.jsx("span", {
                            className: "bubble-pin-marker",
                            "aria-label": "Pinned",
                            children: x.jsx(ImPinIcon, {
                              filled: true
                            })
                          }), h.copied && "Copied · ", h
                          .exported && "Exported · ",
                          messageTimeLabel(h.createdAt), h
                          .edited && " · edited"
                        ]
                      })]
                    })
                  ]
                })]
              })]
            })]
          }, h.id)
        }
      }) : x.jsx("p", {
        className: "empty",
        children: noteMessages.length ? "No messages match this view." : "Send your first message."
      }) : x.jsx("p", {
        className: "empty",
        children: loadingTimedOut ? x.jsxs(x.Fragment, {
          children: ["The note did not arrive. ", x.jsx("button", {
            type: "button",
            className: "plain retry",
            onClick: () => {
              setLoadingTimedOut(false), Im()
            },
            children: "Retry"
          })]
        }) : "Loading note…"
      })
    }), messageMenu && x.jsxs("div", {
      ref: menuRef,
      className: "context-menu ui-context-menu",
      role: "menu",
      style: {
        left: messageMenu.x,
        top: messageMenu.y,
        maxHeight: messageMenu.maxHeight,
        maxWidth: messageMenu.maxWidth
      },
      onPointerDown: h => {
        h.stopPropagation();
        menuPress.current = true
      },
      onClickCapture: h => {
        if (messageMenu.touch && !menuPress.current && h.detail !== 0) {
          h.preventDefault();
          h.stopPropagation();
          return
        }
        menuPress.current = false
      },
      onKeyDown: h => {
        if (h.key === "Escape") {
          h.stopPropagation();
          setMessageMenu(null)
        } else if (h.key === "Enter" || h.key === " ") {
          menuPress.current = true;
          h.stopPropagation()
        }
      },
      children: x.jsx(ImMessageActions, {
        key: messageMenu.messageId,
        message: noteMessages.find(message => message.id === messageMenu.messageId),
        tags: emojiOrder,
        onToggle: tag => toggleMessageTag(messageMenu.messageId, tag),
        actions: [
          ["Edit", "edit", () => {
            if (titleEdit) {
              transfer.notify("Finish or cancel the current title entry first.");
              setMessageMenu(null);
              return;
            }
            const h = noteMessages.find(R => R.id === messageMenu.messageId);
            h && (sessions.rememberEdit(noteRef.current, h.id, h.text), setPinView(false),
              setEditingId(h.id), setEditingText(h.text), requestAnimationFrame(() => {
                resizeComposer();
                const field = inputRef.current;
                if (field) {
                  field.focus({
                    preventScroll: true
                  });
                  field.setSelectionRange(field.value.length, field.value.length)
                }
              })), setMessageMenu(null)
          }],
          ...(imFormat.title(noteMessages.find(m => m.id === messageMenu.messageId)) ? [
            ["Edit title", "textSize", () => {
              const message = noteMessages.find(m => m.id === messageMenu.messageId);
              if (message) startTitle(message)
            }]
          ] : []),
          ["Reply", "reply", () => {
            const message = noteMessages.find(message => message.id === messageMenu.messageId);
            if (message) startReply(message)
          }],
          [imPinIds(editorSettings).includes(messageMenu.messageId) ? "Unpin" : "Pin", imPinIds(
            editorSettings).includes(messageMenu.messageId) ? "unpin" : "pin", () => {
            const id = messageMenu.messageId;
            const ids = imPinIds(editorSettings);
            changeSettings({
              pinnedMessageIds: ids.includes(id) ? ids.filter(item => item !== id) : [...ids,
                id
              ]
            });
            setMessageMenu(null)
          }],
          ["Copy", "copy", () => {
            const message = noteMessages.find(message => message.id === messageMenu.messageId);
            if (message) transfer.copyMessage(message);
            setMessageMenu(null)
          }],
          [selectedIds.has(messageMenu.messageId) ? "Unselect" : "Select", "select", () =>
            toggleMessageSelection(messageMenu.messageId)
          ], null, ["Delete", "trash", () => deleteMessage(messageMenu.messageId), true]
        ]
      })
    }), transfer.notice && x.jsxs("div", {
      className: "transfer-notice",
      role: "status",
      children: [x.jsx("span", {
        children: transfer.notice
      }), x.jsx("button", {
        type: "button",
        "aria-label": "Dismiss import/export notice",
        onClick: transfer.dismissNotice,
        children: "×"
      })]
    }), transfer.dialog && (transfer.dialog.kind === "clear" ? x.jsx(ImClearClipboardDialog, {
      transfer
    }) : x.jsx(ImTransferDialog, {
      transfer
    })), timer.open && !timer.finished && x.jsx(ImSilentTimerDialog, {
      timer
    }), timer.finished && x.jsx(ImTimerFinishedDialog, {
      timer
    }), statusClear.dialog && x.jsx(ImClearStatusDialog, {
      key: noteRef.current?.uuid,
      controller: statusClear
    }), merge.dialog && x.jsx(ImMergeDialog, {
      key: merge.dialog.uuid,
      controller: merge
    }), x.jsx(ImJumpToBottom, {
      viewport
    }), x.jsxs(ImComposerSurface, {
      composerRef,
      noteId: noteRef.current?.uuid,
      pending: sessions.record(noteRef.current?.uuid)?.pending || 0,
      blocked: !!(!noteReady || selectedIds.size || pinView || sessions.record(noteRef.current?.uuid)
        ?.error || sessions.record(noteRef.current?.uuid)?.remote),
      className: `composer${selectedIds.size?" is-selecting":editingId?" is-editing":reply?" is-replying":""}`,
      "aria-label": selectedIds.size ? "Selection status" : editingId ? "Edit a message" :
        "Send a message",
      children: pinView && !selectedIds.size ? x.jsx(ImUnpinAll, {
        count: pinnedMessages.length,
        unpinAll
      }) : selectedIds.size ? x.jsx(ImSelectionStatus, {
        count: selectedIds.size,
        total: noteMessages.length,
        selectAll: () => rememberSelection(new Set(visibleMessages.map(message => message.id))),
        cancel: () => rememberSelection(new Set)
      }) : [!titleEdit && !editingId && reply && x.jsx(ImReplyPreview, {
        key: noteRef.current?.uuid + reply.id,
        reply,
        cancel: () => changeReply(null),
        show: () => showReply(reply),
        exportReply: transfer.exportReply
      }), titleEdit && x.jsx(ImComposerPreview, {
        message: noteMessages.find(m => m.id === titleEdit.id),
        label: "Title for message",
        cancel: cancelTitle,
        cancelLabel: "Cancel title entry"
      }), x.jsx(ImEditPreview, {
        message: !titleEdit && editingId ? noteMessages.find(h => h.id === editingId) : null,
        cancel: cancelEdit
      }), x.jsxs("div", {
        className: "compose-row",
        children: [x.jsx(ImPrivateTextarea, {
          ref: inputRef,
          id: "append-text",
          onRichSubmit: submitComposer,
          onRichResize: resizeComposer,
          richContext: (noteRef.current?.uuid || "") + ":" + (titleEdit ? "title:" +
            titleEdit.id : editingId ? "edit:" + editingId : "capture"),
          richPlain: !!titleEdit,
          value: titleEdit ? titleEdit.text : editingId ? editingText : draftText,
          onChange: h => {
            setComposerText(h.target.value), resizeComposer()
          },
          onKeyDown: h => {
            if (h.key === "Escape" && titleEdit) {
              h.preventDefault();
              h.stopPropagation();
              cancelTitle();
              return
            }
            if (h.key === "Escape" && editingId) {
              h.preventDefault();
              h.stopPropagation();
              cancelEdit();
              return
            }
            h.key === "Enter" && !h.shiftKey && !h.nativeEvent.isComposing && h.nativeEvent
              .keyCode !== 229 && (h.preventDefault(), h.repeat || submitComposer())
          },
          placeholder: titleEdit ? "Write a title…" : editingId ? "Edit your message…" :
            "Write a message…",
          "aria-label": titleEdit ? "Title" : editingId ? "Edit message" : "Message",
          rows: 1,
          disabled: !noteReady || !!noteRef.current?.deleted || timer.finished
        }), x.jsx("button", {
          className: "send-arrow",
          type: "button",
          onPointerDown: event => {
            if (event.button === 0 && document.activeElement === inputRef.current) event
              .preventDefault()
          },
          onMouseDown: event => {
            if (document.activeElement === inputRef.current) event.preventDefault()
          },
          onClick: submitComposer,
          disabled: !noteReady || timer.finished || (!titleEdit && !composerHasText(
            editingId ? editingText : draftText)),
          "aria-label": titleEdit ? "Save title" : editingId ? "Save changes" :
            "Send message",
          title: titleEdit ? "Save title" : editingId ? "Save changes" : "Send",
          children: editingId ? x.jsx("svg", {
            width: 24,
            height: 24,
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: 2.5,
            strokeLinecap: "round",
            strokeLinejoin: "round",
            "aria-hidden": true,
            children: x.jsx("path", {
              d: "m5 12 4 4L19 6"
            })
          }) : x.jsx("svg", {
            width: 24,
            height: 24,
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: 2,
            strokeLinecap: "round",
            strokeLinejoin: "round",
            "aria-hidden": true,
            focusable: "false",
            children: x.jsx("path", {
              d: "M12 20V4m-6 6 6-6 6 6"
            })
          })
        })]
      })]
    })]
  })
}
km.createRoot(document.getElementById("root")).render(x.jsx(dt.StrictMode, {
  children: x.jsx(ImEditor, {})
}));
